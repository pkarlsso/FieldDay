import User from '../models/User.js';
import Session from '../models/Session.js';
import Rating from '../models/Rating.js';
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
const DEFAULT_DISCOVERY_RADIUS_MILES = 25;
const MILES_TO_METERS = 1609.344;
const SESSION_LIMITS = { sport: 30, location: 120, minParticipants: 2, maxParticipants: 50 };
// Maps the host's 1-3 skill level onto the 1-5 scale that discovery filters
// use, matching Explore's Beginner / Intermediate / Advanced options.
const SKILL_LEVEL_RANGES = { 1: { min: 1, max: 2 }, 2: { min: 2, max: 4 }, 3: { min: 4, max: 5 } };
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_SESSION_LENGTH_MS = 2 * HOUR_MS;
const MAX_SESSION_LENGTH_MS = 24 * HOUR_MS;
// How long after a session ends players can answer "who didn't show up?".
const NO_SHOW_WINDOW_MS = 48 * HOUR_MS;
const COMPLETED_SESSIONS_LIMIT = 20;

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

async function createDemoAuthSession(user, message) {
  if (process.env.AUTH_DEMO_BYPASS !== 'true') return null;
  const token = await authSessions.createAuthSession(user._id);
  return authSuccess(user, message, { token, requiresTwoFactor: false });
}

function requireUser(context) {
  if (!context.currentUser) throw new Error('You must be signed in to do that.');
  return context.currentUser;
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

// Works whether a reference is a raw ObjectId or a populated document.
function idOf(value) {
  return String(value?._id ?? value);
}

function isParticipant(session, userId) {
  return session.participants.some((participant) => idOf(participant) === String(userId));
}

function sessionEnd(session) {
  return session.endsAt
    ? new Date(session.endsAt)
    : new Date(new Date(session.startsAt).getTime() + DEFAULT_SESSION_LENGTH_MS);
}

// Sessions ended by the clock keep a stored status of "upcoming", so always
// ask this rather than reading session.status.
function hasEnded(session, now = new Date()) {
  return session.status === 'completed' || sessionEnd(session) <= now;
}

function sessionStatus(session, now = new Date()) {
  if (hasEnded(session, now)) return 'completed';
  return new Date(session.startsAt) <= now ? 'in_progress' : 'upcoming';
}

// Stored as completed before end times and no-show reports existed. These
// keep the old rule that every participant may rate.
function isLegacyCompleted(session) {
  return session.status === 'completed' && !session.endsAt;
}

function noShowDeadline(session) {
  return new Date(sessionEnd(session).getTime() + NO_SHOW_WINDOW_MS);
}

function noShowReportBy(session, userId) {
  return (session.noShowReports || []).find((report) => idOf(report.reporter) === String(userId));
}

// How many of the other players who answered the no-show check flagged this
// player, out of how many answered.
function noShowTally(session, userId) {
  const others = (session.noShowReports || []).filter((report) => idOf(report.reporter) !== String(userId));
  const flagged = others.filter((report) => report.noShows.some((id) => idOf(id) === String(userId))).length;
  return { flagged, answered: others.length };
}

// A no-show needs more than half of the other answers, so one player can't
// mark someone absent on their own in a larger group.
function isNoShow(session, userId) {
  const { flagged, answered } = noShowTally(session, userId);
  return flagged > 0 && flagged * 2 > answered;
}

function ratingEligibility(session, userId, now = new Date()) {
  if (!userId) return { eligible: false, reason: 'Sign in to rate this session.' };
  if (!isParticipant(session, userId)) {
    return { eligible: false, reason: 'Only people who played in the session can rate it.' };
  }
  if (!hasEnded(session, now)) {
    return { eligible: false, reason: 'Only completed sessions can be rated. This one hasn\'t ended yet.' };
  }
  if (session.ratedBy.some((id) => idOf(id) === String(userId))) {
    return { eligible: false, reason: 'You have already rated this session.' };
  }
  if (isLegacyCompleted(session)) return { eligible: true, reason: null };
  if (isNoShow(session, userId)) {
    return { eligible: false, reason: 'Other players reported that you didn\'t show up, so you can\'t rate this session.' };
  }
  if (!noShowReportBy(session, userId)) {
    return now <= noShowDeadline(session)
      ? { eligible: false, reason: 'Tell us who didn\'t show up before rating the other players.' }
      : { eligible: false, reason: 'The no-show check closed before you answered, so you can\'t rate this session.' };
  }
  return { eligible: true, reason: null };
}

function validateRatingSubmission(session, raterId, ratings) {
  const { eligible, reason } = ratingEligibility(session, raterId);
  if (!eligible) throw new Error(reason);
  const reportedNoShows = noShowReportBy(session, raterId)?.noShows || [];

  const seen = new Set();
  for (const { userId, rating } of ratings) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('Ratings must be whole numbers from 1 to 5');
    }
    if (String(userId) === String(raterId)) throw new Error('You cannot rate yourself');
    if (!isParticipant(session, userId)) throw new Error('You can only rate people who played in the session');
    if (reportedNoShows.some((id) => idOf(id) === String(userId))) {
      throw new Error('You can\'t rate a player you reported as a no-show');
    }
    if (seen.has(String(userId))) throw new Error('Each player can only be rated once per submission');
    seen.add(String(userId));
  }
}

// Atomically folds a new rating into the user's running average, so
// concurrent submissions can't overwrite each other's counts. Mongoose 9
// rejects update pipelines unless updatePipeline is set explicitly.
function applyRatingToUser(userId, value) {
  return User.updateOne({ _id: userId }, [
    { $set: { ratingSum: { $add: ['$ratingSum', value] }, totalRatings: { $add: ['$totalRatings', 1] } } },
    { $set: { socialRating: { $round: [{ $divide: ['$ratingSum', '$totalRatings'] }, 1] } } }
  ], { updatePipeline: true });
}

function authSuccess(user, message, extra = {}) {
  return { success: true, message, userId: user.id, ...extra };
}

// Validates everything FR-1 needs before a session is stored. The skill band
// stored for discovery (skillMin/skillMax/skillRange) is derived from
// skillLevel, so any band an older client sends is ignored.
function formatSessionInput(input) {
  const sport = cleanProfileText(input.sport, 'Sport', SESSION_LIMITS.sport, { required: true });
  const location = cleanProfileText(input.location, 'Location', SESSION_LIMITS.location, { required: true });

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error('startsAt must be a valid ISO date');
  if (startsAt <= new Date()) throw new Error('Choose a date and time in the future');

  let endsAt = new Date(startsAt.getTime() + DEFAULT_SESSION_LENGTH_MS);
  if (input.endsAt !== undefined && input.endsAt !== null) {
    endsAt = new Date(input.endsAt);
    if (Number.isNaN(endsAt.getTime())) throw new Error('endsAt must be a valid ISO date');
    if (endsAt <= startsAt) throw new Error('The end time must be after the start time');
    if (endsAt - startsAt > MAX_SESSION_LENGTH_MS) throw new Error('Sessions can last at most 24 hours');
  }

  const { longitude, latitude } = input.locationPoint;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('locationPoint coordinates are out of range');
  }

  const { minParticipants, maxParticipants } = SESSION_LIMITS;
  if (input.maxParticipants === undefined || input.maxParticipants === null) {
    throw new Error('Choose how many players can join');
  }
  if (!Number.isInteger(input.maxParticipants)
    || input.maxParticipants < minParticipants || input.maxParticipants > maxParticipants) {
    throw new Error(`Maximum players must be a whole number from ${minParticipants} to ${maxParticipants}`);
  }

  if (input.skillLevel === undefined || input.skillLevel === null) throw new Error('Choose a skill level');
  const skillBand = SKILL_LEVEL_RANGES[input.skillLevel];
  if (!skillBand) throw new Error('Skill level must be 1 (beginner), 2 (intermediate) or 3 (advanced)');

  return {
    sport,
    location,
    date: startsAt.toISOString().slice(0, 10),
    time: startsAt.toISOString().slice(11, 16),
    startsAt,
    endsAt,
    locationPoint: { type: 'Point', coordinates: [longitude, latitude] },
    skillLevel: input.skillLevel,
    skillMin: skillBand.min,
    skillMax: skillBand.max,
    skillRange: `${skillBand.min.toFixed(1)}-${skillBand.max.toFixed(1)}`,
    tags: input.tags || [],
    maxParticipants: input.maxParticipants
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
    distanceMiles: (session) => session._distanceMiles ?? null,
    endsAt: (session) => sessionEnd(session).toISOString(),
    status: (session) => sessionStatus(session),
    createdAt: (session) => (session.createdAt ? new Date(session.createdAt).toISOString() : null),
    completedAt: (session) => (hasEnded(session) ? sessionEnd(session).toISOString() : null),
    noShowDeadline: (session) => (
      hasEnded(session) && !isLegacyCompleted(session) ? noShowDeadline(session).toISOString() : null
    ),
    attendance: async (session) => {
      const participants = session.populated('participants')
        ? session.participants
        : await User.find({ _id: { $in: session.participants } });
      return participants.filter(Boolean).map((user) => ({
        user,
        status: isNoShow(session, user._id) ? 'NO_SHOW' : 'SHOWED_UP',
        noShowReports: noShowTally(session, user._id).flagged
      }));
    },
    myNoShowReport: (session, _, context) => {
      const report = context.currentUser && noShowReportBy(session, context.currentUser._id);
      return report
        ? { noShows: report.noShows.map(idOf), reportedAt: new Date(report.reportedAt).toISOString() }
        : null;
    },
    ratingEligibility: (session, _, context) => ratingEligibility(session, context.currentUser?._id)
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
      const now = new Date();
      return Session.find({
        // Ended by status, by stored end time, or (older sessions) 2h after start.
        $or: [
          { status: 'completed' },
          { endsAt: { $lte: now } },
          { endsAt: { $exists: false }, startsAt: { $lte: new Date(now.getTime() - DEFAULT_SESSION_LENGTH_MS) } }
        ],
        participants: userId,
        rated: { $ne: true },
        ratedBy: { $ne: userId }
      })
        .populate('participants')
        .populate('host')
        .sort({ createdAt: -1 });
    },

    getMySessions: async (_, __, context) => {
      const user = requireUser(context);
      const sessions = await Session.find({ $or: [{ participants: user._id }, { host: user._id }] })
        .populate('participants')
        .populate('host')
        .sort({ startsAt: 1 });
      const now = new Date();
      const isHost = (session) => session.host && idOf(session.host) === String(user._id);
      const open = sessions.filter((session) => !hasEnded(session, now));
      return {
        hosted: open.filter(isHost),
        joined: open.filter((session) => !isHost(session)),
        completed: sessions
          .filter((session) => hasEnded(session, now))
          .sort((a, b) => sessionEnd(b) - sessionEnd(a))
          .slice(0, COMPLETED_SESSIONS_LIMIT)
      };
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
      if (session.status !== 'upcoming' || hasEnded(session)) throw new Error('Only upcoming sessions can be joined');
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
      if (hasEnded(session)) throw new Error('You cannot leave a session that has ended');
      session.participants = session.participants.filter((id) => !id.equals(userId));
      await session.save();
      return populatedSessionQuery(sessionId);
    },

    reportNoShows: async (_, { sessionId, noShowUserIds }, context) => {
      const user = requireUser(context);
      const session = await Session.findById(sessionId);
      if (!session) throw new Error('Session not found');
      if (!isParticipant(session, user._id)) throw new Error('Only players in this session can report no-shows');
      if (!hasEnded(session)) throw new Error('You can report no-shows once the session has ended');
      if (isLegacyCompleted(session)) throw new Error('No-show reports were not collected for this session');
      if (new Date() > noShowDeadline(session)) throw new Error('The no-show check for this session has closed');
      if (session.ratedBy.some((id) => id.equals(user._id))) {
        throw new Error('You have already rated this session, so your answer can no longer change');
      }

      const noShows = [...new Set(noShowUserIds.map(String))];
      if (noShows.includes(String(user._id))) throw new Error('You cannot report yourself as a no-show');
      if (!noShows.every((id) => isParticipant(session, id))) {
        throw new Error('You can only report players who joined this session');
      }

      const existing = noShowReportBy(session, user._id);
      if (existing) {
        existing.noShows = noShows;
        existing.reportedAt = new Date();
      } else {
        session.noShowReports.push({ reporter: user._id, noShows, reportedAt: new Date() });
      }
      await session.save();
      return populatedSessionQuery(session._id);
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
        { returnDocument: 'after' }
      );
      // No-shows can never rate, so they don't hold this up.
      const everyoneRated = updatedSession.participants
        .filter((participant) => !isNoShow(updatedSession, participant))
        .every((participant) => updatedSession.ratedBy.some((id) => id.equals(participant)));
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

      if (process.env.AUTH_DEMO_BYPASS === 'true') {
        await user.save();
        return createDemoAuthSession(user, 'Account created for demo testing.');
      }

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

      const demoAuth = await createDemoAuthSession(user, 'Welcome back.');
      if (demoAuth) return demoAuth;

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
    }
  }
};

export default resolvers;
