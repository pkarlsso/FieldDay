const User = require('../models/User');
const Session = require('../models/Session');
const Rating = require('../models/Rating');
const FriendRequest = require('../models/FriendRequest');
const { validatePasswordStrength, PASSWORD_REQUIREMENTS, hashPassword, verifyPassword } = require('../utils/password');
const { generateCode, hashCode, CODE_TTL_MS, MAX_ATTEMPTS } = require('../utils/twoFactor');
const { RESET_CODE_TTL_MS } = require('../utils/passwordReset');
const authSessions = require('../utils/authSession');
// Called through the module objects (not destructured) so tests can stub them.
const mailer = require('../utils/mailer');
const googleAuth = require('../utils/googleAuth');

const PROFILE_LIMITS = { name: 50, bio: 300, hometown: 80, sport: 30, sportCount: 10, pictureChars: 200000 };
const PICTURE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

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

function publicUserQuery(id) {
  return User.findById(id).select('name bio hometown profilePicture sports socialRating');
}

function populatedFriendRequestQuery(id) {
  return FriendRequest.findById(id).populate('requester').populate('recipient');
}

async function createFriendRequest(requesterId, recipientId) {
  if (String(requesterId) === String(recipientId)) throw new Error('You cannot send a friend request to yourself');

  const [requester, recipient] = await Promise.all([
    User.findById(requesterId),
    User.findById(recipientId)
  ]);
  if (!requester || !recipient) throw new Error('User not found');
  if (requester.friends.some((id) => id.equals(recipientId))) {
    throw new Error('You are already friends');
  }

  const existing = await FriendRequest.findOne({
    status: 'pending',
    $or: [
      { requester: requesterId, recipient: recipientId },
      { requester: recipientId, recipient: requesterId }
    ]
  });
  if (existing) throw new Error('A friend request is already pending');

  try {
    const request = await FriendRequest.create({ requester: requesterId, recipient: recipientId });
    return populatedFriendRequestQuery(request._id);
  } catch (err) {
    if (err.code === 11000) throw new Error('A friend request is already pending');
    throw err;
  }
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
  return {
    ...input,
    date: startsAt.toISOString().slice(0, 10),
    time: startsAt.toISOString().slice(11, 16),
    startsAt,
    locationPoint: { type: 'Point', coordinates: [longitude, latitude] }
  };
}

function populatedSessionQuery(id) {
  return Session.findById(id).populate('participants').populate('host');
}

const resolvers = {
  Session: {
    startsAt: (session) => new Date(session.startsAt).toISOString()
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

  PublicUser: {
    id: (user) => String(user._id || user.id)
  },

  FriendRequest: {
    id: (request) => String(request._id || request.id),
    requester: (request) => request.requester,
    recipient: (request) => request.recipient,
    status: (request) => request.status,
    createdAt: (request) => new Date(request.createdAt).toISOString(),
    updatedAt: (request) => new Date(request.updatedAt).toISOString()
  },

  Query: {
    getRatingsForUser: async (_, { userId }) => Rating.find({ ratee: userId }).sort({ createdAt: -1 }),

    getRatingsBySession: async (_, { sessionId, raterId }) => Rating.find({ session: sessionId, rater: raterId }),

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

    getSessions: async (_, { status }) => {
      const filter = status ? { status } : {};
      return Session.find(filter)
        .populate('participants')
        .populate('host')
        .sort({ createdAt: -1 });
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
    },

    findUserById: async (_, { id }, context) => {
      requireUser(context);
      return publicUserQuery(id);
    },

    getMyFriendRequests: async (_, { status = 'pending' }, context) => {
      const user = requireUser(context);
      const filter = { $or: [{ requester: user._id }, { recipient: user._id }] };
      if (status) filter.status = status;
      return FriendRequest.find(filter)
        .populate('requester')
        .populate('recipient')
        .sort({ createdAt: -1 });
    },

    getFriendCandidates: async (_, __, context) => {
      const user = requireUser(context);
      const sessions = await Session.find({ status: 'completed', participants: user._id }, 'participants');
      const participantIds = [...new Set(sessions.flatMap((session) => session.participants.map(String)))]
        .filter((id) => id !== String(user._id) && !user.friends.some((friendId) => String(friendId) === id));
      if (participantIds.length === 0) return [];

      const pending = await FriendRequest.find({
        status: 'pending',
        $or: [
          { requester: user._id, recipient: { $in: participantIds } },
          { requester: { $in: participantIds }, recipient: user._id }
        ]
      }, 'requester recipient');
      const pendingIds = new Set(pending.flatMap(({ requester, recipient }) => [String(requester), String(recipient)]));
      return User.find({ _id: { $in: participantIds.filter((id) => !pendingIds.has(id)) } })
        .select('name bio hometown profilePicture sports socialRating');
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
          try {
            await createFriendRequest(raterId, userId);
            friendsSent++;
          } catch (err) {
            if (!['A friend request is already pending', 'You are already friends'].includes(err.message)) {
              throw err;
            }
          }
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

    addFriend: async (_, { userId, friendId }, context) => {
      const user = requireUser(context);
      if (String(user._id) !== String(userId)) throw new Error('You can only add friends for yourself');
      await createFriendRequest(user._id, friendId);
      return User.findById(user._id).populate('friends');
    },

    sendFriendRequest: async (_, { recipientId }, context) => {
      const user = requireUser(context);
      return createFriendRequest(user._id, recipientId);
    },

    acceptFriendRequest: async (_, { requestId }, context) => {
      const user = requireUser(context);
      const request = await FriendRequest.findById(requestId);
      if (!request) throw new Error('Friend request not found');
      if (!request.recipient.equals(user._id)) throw new Error('Only the recipient can accept this request');
      if (request.status !== 'pending') throw new Error('This friend request is no longer pending');

      request.status = 'accepted';
      await request.save();
      await Promise.all([
        User.updateOne({ _id: request.requester }, { $addToSet: { friends: request.recipient } }),
        User.updateOne({ _id: request.recipient }, { $addToSet: { friends: request.requester } })
      ]);
      return populatedFriendRequestQuery(request._id);
    },

    declineFriendRequest: async (_, { requestId }, context) => {
      const user = requireUser(context);
      const request = await FriendRequest.findById(requestId);
      if (!request) throw new Error('Friend request not found');
      if (!request.recipient.equals(user._id)) throw new Error('Only the recipient can decline this request');
      if (request.status !== 'pending') throw new Error('This friend request is no longer pending');

      request.status = 'declined';
      await request.save();
      return populatedFriendRequestQuery(request._id);
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
        console.error('Google sign-in failed:', err.message);
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
    }
  }
};

module.exports = resolvers;
