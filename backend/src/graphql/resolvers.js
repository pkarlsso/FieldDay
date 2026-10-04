import User from '../models/User.js';
import Session from '../models/Session.js';
import Rating from '../models/Rating.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import chatEvents from '../utils/chatEvents.js';
import { validatePasswordStrength, PASSWORD_REQUIREMENTS, hashPassword, verifyPassword } from '../utils/password.js';
import { generateCode, hashCode, CODE_TTL_MS, MAX_ATTEMPTS } from '../utils/twoFactor.js';
import { RESET_CODE_TTL_MS } from '../utils/passwordReset.js';
import * as authSessions from '../utils/authSession.js';
// Called through the module objects (not destructured) so tests can stub them.
import mailer from '../utils/mailer.js';
import googleAuth from '../utils/googleAuth.js';
import logger from '../utils/logger.js';

const PROFILE_LIMITS = { name: 50, bio: 300, hometown: 80, sport: 30, sportCount: 10, pictureChars: 200000 };
const PICTURE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const MESSAGE_MAX_LENGTH = 2000;
const MESSAGE_PAGE_SIZE = 50;
const DEFAULT_DISCOVERY_RADIUS_MILES = 25;
const MILES_TO_METERS = 1609.344;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function issueTwoFactorCode(user) {
  const code = generateCode();
  user.twoFactorCodeHash = hashCode(code);
  user.twoFactorCodeExpires = new Date(Date.now() + CODE_TTL_MS);
  user.twoFactorAttempts = 0;
  await user.save();
  await mailer.sendTwoFactorEmail(user.email, code);
}

function requireUser(context) {
  if (!context.currentUser) throw new Error('You must be signed in to do that.');
  return context.currentUser;
}

function sameId(left, right) {
  return String(left) === String(right);
}

function hasParticipant(conversation, userId) {
  return conversation.participants.some((participant) => sameId(participant, userId));
}

async function getAuthorizedConversation(conversationId, user, { allowFormerSession = false } = {}) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error('Conversation not found');
  if (!hasParticipant(conversation, user._id)) {
    if (!(allowFormerSession && conversation.kind === 'session')) throw new Error('You cannot access this conversation');
    const session = await Session.findById(conversation.session);
    if (!session || !hasParticipant(conversation, user._id)) throw new Error('You cannot access this conversation');
  }
  if (conversation.kind === 'session') {
    const session = await Session.findById(conversation.session);
    if (!session) throw new Error('Session not found');
    return { conversation, session, canSend: hasParticipant(session, user._id) };
  }
  return { conversation, canSend: true };
}

function cleanMessageBody(body) {
  if (typeof body !== 'string') throw new Error('Message must be text');
  const cleaned = body.trim();
  if (!cleaned) throw new Error('Message cannot be empty');
  if (cleaned.length > MESSAGE_MAX_LENGTH) throw new Error(`Message must be ${MESSAGE_MAX_LENGTH} characters or fewer`);
  return cleaned;
}

function serializeMessage(message, userId) {
  return {
    ...message.toObject(),
    conversationId: String(message.conversation),
    mine: sameId(message.sender._id || message.sender, userId),
    read: message.readBy.some((id) => sameId(id, userId))
  };
}

async function ensureSessionConversation(session) {
  return Conversation.findOneAndUpdate(
    { session: session._id },
    { $setOnInsert: { kind: 'session', session: session._id, participants: session.participants } },
    { new: true, upsert: true }
  );
}

async function conversationView(conversation, user) {
  const messages = await Message.find({ conversation: conversation._id })
    .sort({ createdAt: -1, _id: -1 }).limit(1).populate('sender', 'name profilePicture');
  const unreadCount = await Message.countDocuments({
    conversation: conversation._id,
    readBy: { $ne: user._id },
    sender: { $ne: user._id }
  });
  const participants = await User.find({ _id: { $in: conversation.participants } }).select('name profilePicture');
  const otherNames = participants.filter((participant) => !sameId(participant._id, user._id)).map(({ name }) => name);
  return {
    ...conversation.toObject(),
    sessionId: conversation.session ? String(conversation.session) : null,
    name: conversation.kind === 'session' ? (otherNames[0] || 'Session chat') : (otherNames.join(', ') || 'Direct message'),
    participants,
    messages: messages.map((message) => serializeMessage(message, user._id)),
    unreadCount,
    lastMessageAt: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null
  };
}

// Trims an optional profile text field and enforces its length. Returns
// undefined when the field was not supplied, so callers can skip it.
function cleanProfileText(value, label, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (required && !trimmed) throw new Error(`${label} cannot be empty`);
  if (trimmed.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return trimmed;
}

// Accepts a base64 image data URI (the app sends a 256px JPEG) or '' to remove
// the picture. Returns undefined when the field was not supplied.
function cleanProfilePicture(value) {
  if (value === undefined || value === null) return undefined;
  if (value === '') return '';
  if (value.length > PROFILE_LIMITS.pictureChars) throw new Error('Profile picture is too large');
  if (!PICTURE_PATTERN.test(value)) throw new Error('Profile picture must be a JPEG, PNG or WebP image');
  return value;
}

function cleanSportSkills(sportSkills) {
  if (sportSkills.length > PROFILE_LIMITS.sportCount) {
    throw new Error(`You can list at most ${PROFILE_LIMITS.sportCount} sports`);
  }
  const seen = new Set();
  return sportSkills.map(({ sport, skillLevel }) => {
    const name = cleanProfileText(sport, 'Sport name', PROFILE_LIMITS.sport, { required: true });
    if (seen.has(name.toLowerCase())) throw new Error(`${name} is listed more than once`);
    seen.add(name.toLowerCase());
    if (!Number.isInteger(skillLevel) || skillLevel < 1 || skillLevel > 5) {
      throw new Error(`Skill level for ${name} must be a whole number from 1 to 5`);
    }
    return { sport: name, skillLevel };
  });
}

function validateRatingSubmission(session, raterId, ratings) {
  if (session.status !== 'completed') throw new Error('Only completed sessions can be rated');
  const isParticipant = (id) => session.participants.some((participant) => participant.equals(id));
  if (!isParticipant(raterId)) throw new Error('Only people who played in the session can rate it');
  if (session.ratedBy.some((id) => id.equals(raterId))) throw new Error('You have already rated this session');

  const seen = new Set();
  for (const { userId, rating } of ratings) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('Ratings must be whole numbers from 1 to 5');
    }
    if (String(userId) === String(raterId)) throw new Error('You cannot rate yourself');
    if (!isParticipant(userId)) throw new Error('You can only rate people who played in the session');
    if (seen.has(String(userId))) throw new Error('Each player can only be rated once per submission');
    seen.add(String(userId));
  }
}

// Atomically folds a new rating into the user's running average, so
// concurrent submissions can't overwrite each other's counts.
function applyRatingToUser(userId, value) {
  return User.updateOne({ _id: userId }, [
    { $set: { ratingSum: { $add: ['$ratingSum', value] }, totalRatings: { $add: ['$totalRatings', 1] } } },
    { $set: { socialRating: { $round: [{ $divide: ['$ratingSum', '$totalRatings'] }, 1] } } }
  ]);
}

function authSuccess(user, message, extra = {}) {
  return { success: true, message, userId: user.id, ...extra };
}

function formatSessionInput(input) {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error('startsAt must be a valid ISO date');
  const { longitude, latitude } = input.locationPoint;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('locationPoint coordinates are out of range');
  }
  if (input.skillMin !== undefined && input.skillMax !== undefined
    && (input.skillMin < 1 || input.skillMax > 5 || input.skillMin > input.skillMax)) {
    throw new Error('skill bounds must be between 1 and 5, with skillMin no greater than skillMax');
  }
  return {
    ...input,
    date: startsAt.toISOString().slice(0, 10),
    time: startsAt.toISOString().slice(11, 16),
    startsAt,
    locationPoint: { type: 'Point', coordinates: [longitude, latitude] },
    tags: input.tags || []
  };
}

function parseSkillRange(skillRange) {
  if (typeof skillRange !== 'string') return null;
  const match = skillRange.trim().match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return Number.isFinite(min) && Number.isFinite(max) && min <= max ? { min, max } : null;
}

function validateDiscoveryFilter(filter = {}) {
  const normalized = { ...filter };
  if (normalized.origin) {
    const { longitude, latitude } = normalized.origin;
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error('filter.origin coordinates are out of range');
    }
  }
  if (normalized.maxDistanceMiles !== undefined
    && (!Number.isFinite(normalized.maxDistanceMiles) || normalized.maxDistanceMiles <= 0)) {
    throw new Error('maxDistanceMiles must be greater than zero');
  }
  if (normalized.maxDistanceMiles !== undefined && !normalized.origin) {
    throw new Error('origin is required when maxDistanceMiles is provided');
  }
  if (normalized.minSkillLevel !== undefined
    && (!Number.isFinite(normalized.minSkillLevel) || normalized.minSkillLevel < 1 || normalized.minSkillLevel > 5)) {
    throw new Error('minSkillLevel must be between 1 and 5');
  }
  if (normalized.maxSkillLevel !== undefined
    && (!Number.isFinite(normalized.maxSkillLevel) || normalized.maxSkillLevel < 1 || normalized.maxSkillLevel > 5)) {
    throw new Error('maxSkillLevel must be between 1 and 5');
  }
  if (normalized.minSkillLevel !== undefined && normalized.maxSkillLevel !== undefined
    && normalized.minSkillLevel > normalized.maxSkillLevel) {
    throw new Error('minSkillLevel cannot be greater than maxSkillLevel');
  }
  for (const field of ['startsAfter', 'startsBefore']) {
    if (normalized[field] !== undefined && Number.isNaN(new Date(normalized[field]).getTime())) {
      throw new Error(`${field} must be a valid ISO date`);
    }
  }
  if (normalized.startsAfter && normalized.startsBefore
    && new Date(normalized.startsAfter) > new Date(normalized.startsBefore)) {
    throw new Error('startsAfter cannot be later than startsBefore');
  }
  if (normalized.minOpenSpots !== undefined
    && (!Number.isInteger(normalized.minOpenSpots) || normalized.minOpenSpots < 0)) {
    throw new Error('minOpenSpots must be a non-negative whole number');
  }
  return normalized;
}

function discoveryQuery(status, input) {
  const filter = validateDiscoveryFilter(input);
  const query = { status: status || 'upcoming' };
  if (query.status === 'upcoming') query.startsAt = { $gte: new Date() };
  if (filter.sports?.length) query.sport = { $in: filter.sports };
  if (filter.startsAfter || filter.startsBefore) {
    query.startsAt = {
      ...(query.startsAt || {}),
      ...(filter.startsAfter ? { $gte: new Date(filter.startsAfter) } : {}),
      ...(filter.startsBefore ? { $lte: new Date(filter.startsBefore) } : {})
    };
  }
  if (filter.minOpenSpots !== undefined) {
    query.$expr = {
      $gte: [
        { $subtract: ['$maxParticipants', { $size: { $ifNull: ['$participants', []] } }] },
        filter.minOpenSpots
      ]
    };
  }
  if (filter.tags?.length) query.tags = { $all: filter.tags };
  if (filter.origin) {
    const maxDistanceMiles = filter.maxDistanceMiles ?? DEFAULT_DISCOVERY_RADIUS_MILES;
    query.locationPoint = {
      $near: {
        $geometry: { type: 'Point', coordinates: [filter.origin.longitude, filter.origin.latitude] },
        $maxDistance: maxDistanceMiles * MILES_TO_METERS
      }
    };
  }
  return { query, filter };
}

function skillRangeMatches(session, filter) {
  if (filter.minSkillLevel === undefined && filter.maxSkillLevel === undefined) return true;
  const range = parseSkillRange(session.skillRange);
  const min = session.skillMin ?? range?.min;
  const max = session.skillMax ?? range?.max;
  if (min === undefined || max === undefined) return false;
  return (filter.minSkillLevel === undefined || max >= filter.minSkillLevel)
    && (filter.maxSkillLevel === undefined || min <= filter.maxSkillLevel);
}

function distanceMiles(session, origin) {
  if (!origin || !session.locationPoint?.coordinates) return null;
  const [longitude, latitude] = session.locationPoint.coordinates;
  const latitudeDelta = (latitude - origin.latitude) * Math.PI / 180;
  const longitudeDelta = (longitude - origin.longitude) * Math.PI / 180;
  const first = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(origin.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180)
      * Math.sin(longitudeDelta / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(first), Math.sqrt(1 - first));
}

function populatedSessionQuery(id) {
  return Session.findById(id).populate('participants').populate('host');
}

const resolvers = {
  Session: {
    startsAt: (session) => new Date(session.startsAt).toISOString(),
    tags: (session) => session.tags || [],
    distanceMiles: (session) => session._distanceMiles ?? null
  },

  User: {
    // Accounts created before per-sport skill levels only have `sports` and one
    // overall `skillLevel`, so fall back to those.
    sportSkills: (user) => (user.sportSkills && user.sportSkills.length > 0
      ? user.sportSkills
      : (user.sports || []).map((sport) => ({ sport, skillLevel: user.skillLevel })))
  },

  Rating: {
    session: (rating) => String(rating.session),
    ratee: (rating) => String(rating.ratee),
    createdAt: (rating) => new Date(rating.createdAt).toISOString()
  },

  Message: {
    id: (message) => String(message._id),
    conversationId: (message) => String(message.conversation),
    createdAt: (message) => new Date(message.createdAt).toISOString()
  },

  Query: {
    getRatingsForUser: async (_, { userId }) => Rating.find({ ratee: userId }).sort({ createdAt: -1 }),

    getRatingsBySession: async (_, { sessionId, raterId }) => Rating.find({ session: sessionId, rater: raterId }),

    getConversations: async (_, __, context) => {
      const user = requireUser(context);
      const sessions = await Session.find({ participants: user._id }).select('_id participants');
      await Promise.all(sessions.map(ensureSessionConversation));
      const conversations = await Conversation.find({
        $or: [{ participants: user._id }, { session: { $in: sessions.map(({ _id }) => _id) } }]
      }).sort({ lastMessageAt: -1, createdAt: -1 });
      return Promise.all(conversations.map((conversation) => conversationView(conversation, user)));
    },

    getConversationMessages: async (_, { conversationId, cursor, limit = MESSAGE_PAGE_SIZE }, context) => {
      const user = requireUser(context);
      const access = await getAuthorizedConversation(conversationId, user, { allowFormerSession: true });
      const boundedLimit = Math.min(Math.max(limit, 1), MESSAGE_PAGE_SIZE);
      const filter = { conversation: access.conversation._id };
      if (cursor) {
        const cursorMessage = await Message.findById(cursor).select('createdAt _id');
        if (!cursorMessage) throw new Error('Invalid message cursor');
        filter.$or = [
          { createdAt: { $lt: cursorMessage.createdAt } },
          { createdAt: cursorMessage.createdAt, _id: { $lt: cursorMessage._id } }
        ];
      }
      const messages = await Message.find(filter).sort({ createdAt: -1, _id: -1 })
        .limit(boundedLimit + 1).populate('sender', 'name profilePicture');
      const hasMore = messages.length > boundedLimit;
      const page = hasMore ? messages.slice(0, boundedLimit) : messages;
      return {
        messages: page.reverse().map((message) => serializeMessage(message, user._id)),
        nextCursor: hasMore ? String(page[0]._id) : null
      };
    },

    getSession: async (_, { id }) => populatedSessionQuery(id),
    getUser: async (_, { id }) => {
      return User.findById(id).populate('friends');
    },

    checkEmailExists: async (_, { email }) => {
      const user = await User.findOne({ email: normalizeEmail(email) });
      return user
        ? { exists: true, message: 'An account with this email already exists. Please log in instead.' }
        : { exists: false, message: null };
    },

    getSessions: async (_, { status, filter: input }) => {
      const { query, filter } = discoveryQuery(status, input);
      const sessions = await Session.find(query)
        .populate('participants')
        .populate('host')
        .sort({ createdAt: -1 });
      return sessions
        .filter((session) => skillRangeMatches(session, filter))
        .map((session) => {
          session._distanceMiles = distanceMiles(session, filter.origin);
          return session;
        });
    },

    getCompletedSessions: async (_, { userId }) => {
      return Session.find({
        status: 'completed',
        participants: userId,
        rated: { $ne: true },
        ratedBy: { $ne: userId }
      })
        .populate('participants')
        .populate('host')
        .sort({ createdAt: -1 });
    },

    getFriends: async (_, { userId }) => {
      const user = await User.findById(userId).populate('friends');
      return user ? user.friends : [];
    }
  },

  Mutation: {
    createSession: async (_, { hostId, input }) => {
      const host = await User.findById(hostId);
      if (!host) throw new Error('Host not found');
      const session = await Session.create({
        ...formatSessionInput(input),
        host: hostId,
        participants: [hostId],
        status: 'upcoming'
      });
      return populatedSessionQuery(session._id);
    },

    joinSession: async (_, { sessionId, userId }) => {
      const [session, user] = await Promise.all([Session.findById(sessionId), User.findById(userId)]);
      if (!session || !user) throw new Error('Session or user not found');
      if (session.status !== 'upcoming') throw new Error('Only upcoming sessions can be joined');
      if (session.participants.some((id) => id.equals(userId))) return populatedSessionQuery(sessionId);
      if (session.participants.length >= session.maxParticipants) throw new Error('Session is full');
      session.participants.push(userId);
      await session.save();
      return populatedSessionQuery(sessionId);
    },

    leaveSession: async (_, { sessionId, userId }) => {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');
      if (session.host && session.host.equals(userId)) throw new Error('The host cannot leave their session');
      session.participants = session.participants.filter((id) => !id.equals(userId));
      await session.save();
      return populatedSessionQuery(sessionId);
    },

    submitRatings: async (_, { sessionId, raterId, ratings }) => {
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');
      validateRatingSubmission(session, raterId, ratings);

      try {
        await Rating.insertMany(ratings.map(({ userId, rating }) => ({
          session: session._id,
          rater: raterId,
          ratee: userId,
          value: rating
        })));
      } catch (err) {
        // The unique (session, rater, ratee) index caught a duplicate.
        if (err.code === 11000) throw new Error('You have already rated this session');
        throw err;
      }

      let totalGiven = 0;
      let friendsSent = 0;

      for (const { userId, rating, addFriend } of ratings) {
        await applyRatingToUser(userId, rating);
        totalGiven += rating;

        if (addFriend) {
          const [rater] = await Promise.all([
            User.updateOne({ _id: raterId }, { $addToSet: { friends: userId } }),
            User.updateOne({ _id: userId }, { $addToSet: { friends: raterId } })
          ]);
          if (rater.modifiedCount > 0) friendsSent++;
        }
      }

      const updatedSession = await Session.findByIdAndUpdate(
        session._id,
        { $addToSet: { ratedBy: raterId } },
        { new: true }
      );
      const everyoneRated = updatedSession.participants.every((participant) =>
        updatedSession.ratedBy.some((id) => id.equals(participant)));
      if (everyoneRated) {
        updatedSession.rated = true;
        await updatedSession.save();
      }

      const avgRatingGiven = ratings.length > 0
        ? Math.round((totalGiven / ratings.length) * 10) / 10
        : 0;

      return {
        success: true,
        message: 'Ratings submitted successfully!',
        avgRatingGiven,
        friendRequestsSent: friendsSent,
        updatedUsers: await User.find({ _id: { $in: ratings.map(({ userId }) => userId) } })
      };
    },

    addFriend: async (_, { userId, friendId }) => {
      const user = await User.findById(userId);
      const friend = await User.findById(friendId);
      if (!user || !friend) throw new Error('User not found');

      if (!user.friends.includes(friendId)) {
        user.friends.push(friendId);
        await user.save();
      }
      if (!friend.friends.includes(userId)) {
        friend.friends.push(userId);
        await friend.save();
      }

      return User.findById(userId).populate('friends');
    },

    signUp: async (_, { email, password }) => {
      const normalizedEmail = normalizeEmail(email);

      if (!validatePasswordStrength(password)) {
        return { success: false, message: PASSWORD_REQUIREMENTS };
      }

      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return { success: false, message: 'An account with this email already exists. Please log in instead.' };
      }

      const passwordHash = await hashPassword(password);
      const user = new User({
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        passwordHash
      });

      await issueTwoFactorCode(user);

      return {
        success: true,
        message: 'We sent a verification code to your email.',
        userId: user.id,
        requiresTwoFactor: true
      };
    },

    login: async (_, { email, password }) => {
      const user = await User.findOne({ email: normalizeEmail(email) });
      if (!user || !user.passwordHash) {
        return { success: false, message: 'Incorrect email or password.' };
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
        return { success: false, message: 'Incorrect email or password.' };
      }

      await issueTwoFactorCode(user);

      return {
        success: true,
        message: 'We sent a verification code to your email.',
        userId: user.id,
        requiresTwoFactor: true
      };
    },

    resendTwoFactorCode: async (_, { email }) => {
      const user = await User.findOne({ email: normalizeEmail(email) });
      if (!user) {
        return { success: false, message: 'Account not found.' };
      }

      await issueTwoFactorCode(user);
      return { success: true, message: 'A new code has been sent to your email.', userId: user.id };
    },

    verifyTwoFactorCode: async (_, { email, code }) => {
      const user = await User.findOne({ email: normalizeEmail(email) });
      if (!user || !user.twoFactorCodeHash || !user.twoFactorCodeExpires) {
        return { success: false, message: 'No verification code is pending. Please request a new one.' };
      }

      if (user.twoFactorCodeExpires < new Date()) {
        return { success: false, message: 'That code has expired. Please request a new one.' };
      }

      if (user.twoFactorAttempts >= MAX_ATTEMPTS) {
        return { success: false, message: 'Too many incorrect attempts. Please request a new code.' };
      }

      if (hashCode(code) !== user.twoFactorCodeHash) {
        user.twoFactorAttempts += 1;
        await user.save();
        return { success: false, message: 'Incorrect code. Please try again.' };
      }

      user.twoFactorCodeHash = null;
      user.twoFactorCodeExpires = null;
      user.twoFactorAttempts = 0;
      await user.save();

      // The token is what lets the app keep the user signed in for 30 days.
      const token = await authSessions.createAuthSession(user._id);
      return authSuccess(user, 'Verified!', { token });
    },

    requestPasswordReset: async (_, { email }) => {
      // Same answer whether or not the account exists, so this can't be used
      // to find out who has a FieldDay account.
      const response = { success: true, message: 'If an account exists for that email, we sent a reset code to it.' };

      const user = await User.findOne({ email: normalizeEmail(email) });
      if (!user) return response;

      const code = generateCode();
      user.passwordResetCodeHash = hashCode(code);
      user.passwordResetCodeExpires = new Date(Date.now() + RESET_CODE_TTL_MS);
      user.passwordResetAttempts = 0;
      await user.save();
      await mailer.sendPasswordResetEmail(user.email, code);

      return response;
    },

    resetPassword: async (_, { email, code, newPassword }) => {
      if (!validatePasswordStrength(newPassword)) {
        return { success: false, message: PASSWORD_REQUIREMENTS };
      }

      const user = await User.findOne({ email: normalizeEmail(email) });
      if (!user || !user.passwordResetCodeHash || !user.passwordResetCodeExpires) {
        return { success: false, message: 'No password reset is pending. Please request a new code.' };
      }

      if (user.passwordResetCodeExpires < new Date()) {
        return { success: false, message: 'That code has expired. Please request a new one.' };
      }

      if (user.passwordResetAttempts >= MAX_ATTEMPTS) {
        return { success: false, message: 'Too many incorrect attempts. Please request a new code.' };
      }

      if (hashCode(code) !== user.passwordResetCodeHash) {
        user.passwordResetAttempts += 1;
        await user.save();
        return { success: false, message: 'Incorrect code. Please try again.' };
      }

      user.passwordHash = await hashPassword(newPassword);
      user.passwordResetCodeHash = null;
      user.passwordResetCodeExpires = null;
      user.passwordResetAttempts = 0;
      // Anything pending from before the reset is no longer trustworthy.
      user.twoFactorCodeHash = null;
      user.twoFactorCodeExpires = null;
      user.twoFactorAttempts = 0;
      await user.save();

      // Sign out every device that was still using the old password.
      await authSessions.revokeAllAuthSessions(user._id);

      return authSuccess(user, 'Your password has been reset. You can log in with it now.');
    },

    googleSignIn: async (_, { idToken }) => {
      let profile;
      try {
        profile = await googleAuth.verifyGoogleIdToken(idToken);
      } catch (err) {
        logger.error('Google sign-in failed', { error: err.message, stack: err.stack });
        return { success: false, message: 'We could not verify your Google sign-in. Please try again.' };
      }

      if (!profile.email || !profile.emailVerified) {
        return { success: false, message: 'Your Google account does not have a verified email address.' };
      }
      const email = normalizeEmail(profile.email);

      // Google has verified this email, so it is safe to attach the Google
      // login to an existing account that uses the same address.
      let user = (await User.findOne({ googleId: profile.sub })) || (await User.findOne({ email }));
      if (user && user.googleId && user.googleId !== profile.sub) {
        return { success: false, message: 'That email is already linked to a different Google account.' };
      }
      if (!user) {
        user = new User({ name: profile.name || email.split('@')[0], email });
      }
      user.googleId = profile.sub;
      await user.save();

      // Google already authenticated the person, so there is no email 2FA step.
      const token = await authSessions.createAuthSession(user._id);
      return authSuccess(user, 'Signed in with Google.', { token });
    },

    restoreSession: async (_, { token }) => {
      const user = await authSessions.restoreAuthSession(token);
      if (!user) return { success: false, message: 'Your session has expired. Please log in again.' };
      return authSuccess(user, 'Welcome back!', { token });
    },

    logout: async (_, { token }) => {
      await authSessions.revokeAuthSession(token);
      return { success: true, message: 'Signed out.' };
    },

    updateProfile: async (_, { input }, context) => {
      const user = requireUser(context);

      const name = cleanProfileText(input.name, 'Name', PROFILE_LIMITS.name, { required: true });
      const bio = cleanProfileText(input.bio, 'Bio', PROFILE_LIMITS.bio);
      const hometown = cleanProfileText(input.hometown, 'Hometown', PROFILE_LIMITS.hometown);
      const profilePicture = cleanProfilePicture(input.profilePicture);
      const sportSkills = input.sportSkills ? cleanSportSkills(input.sportSkills) : undefined;

      if (name !== undefined) user.name = name;
      if (bio !== undefined) user.bio = bio;
      if (hometown !== undefined) user.hometown = hometown;
      if (profilePicture !== undefined) user.profilePicture = profilePicture;
      if (sportSkills !== undefined) {
        user.sportSkills = sportSkills;
        // Keep the older flat fields in step for screens that still read them.
        user.sports = sportSkills.map(({ sport }) => sport);
        if (sportSkills.length > 0) {
          const total = sportSkills.reduce((sum, { skillLevel }) => sum + skillLevel, 0);
          user.skillLevel = Math.round((total / sportSkills.length) * 10) / 10;
        }
      }

      await user.save();
      return User.findById(user._id).populate('friends');
    },

    getOrCreateDirectConversation: async (_, { friendId }, context) => {
      const user = requireUser(context);
      if (sameId(user._id, friendId)) throw new Error('You cannot message yourself');
      const friend = await User.findById(friendId);
      if (!friend || !friend.friends.some((id) => sameId(id, user._id)) || !user.friends.some((id) => sameId(id, friendId))) {
        throw new Error('You can only message a friend');
      }
      const participants = [String(user._id), String(friendId)].sort();
      const participantKey = participants.join(':');
      const conversation = await Conversation.findOneAndUpdate(
        { kind: 'direct', participantKey },
        { $setOnInsert: { kind: 'direct', participants, participantKey } },
        { new: true, upsert: true }
      );
      return conversationView(conversation, user);
    },

    sendMessage: async (_, { conversationId, body, clientMessageId }, context) => {
      const user = requireUser(context);
      const access = await getAuthorizedConversation(conversationId, user);
      if (!access.canSend) throw new Error('You can no longer send messages in this session');
      if (!clientMessageId || clientMessageId.length > 100) throw new Error('clientMessageId is required');
      const cleanedBody = cleanMessageBody(body);
      const existing = await Message.findOne({ conversation: access.conversation._id, clientMessageId }).populate('sender', 'name profilePicture');
      if (existing) return serializeMessage(existing, user._id);
      let message;
      try {
        message = await Message.create({
          conversation: access.conversation._id,
          sender: user._id,
          body: cleanedBody,
          clientMessageId,
          readBy: [user._id]
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        message = await Message.findOne({ conversation: access.conversation._id, clientMessageId });
      }
      await Conversation.updateOne({ _id: access.conversation._id }, { $set: { lastMessageAt: message.createdAt } });
      await message.populate('sender', 'name profilePicture');
      const serialized = serializeMessage(message, user._id);
      chatEvents.emit('message', String(access.conversation._id), { ...serialized, mine: false, read: false });
      return serialized;
    },

    markConversationRead: async (_, { conversationId }, context) => {
      const user = requireUser(context);
      const access = await getAuthorizedConversation(conversationId, user, { allowFormerSession: true });
      await Message.updateMany(
        { conversation: access.conversation._id, sender: { $ne: user._id }, readBy: { $ne: user._id } },
        { $addToSet: { readBy: user._id } }
      );
      return true;
    }
  }
};

export default resolvers;
