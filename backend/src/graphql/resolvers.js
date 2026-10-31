import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Rating from '../models/Rating.js';
import FriendRequest from '../models/FriendRequest.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import chatEvents from '../utils/chatEvents.js';
let participationLimits;
async function getParticipationLimits() {
  participationLimits ||= await import('../utils/participationLimits.mjs');
  return participationLimits;
}
import Media from '../models/Media.js';
import Notification from '../models/Notification.js';
import DeviceToken from '../models/DeviceToken.js';
import * as authSessions from '../utils/authSession.js';
import { validatePasswordStrength, PASSWORD_REQUIREMENTS, hashPassword, verifyPassword } from '../utils/password.js';
import { generateCode, hashCode, CODE_TTL_MS, MAX_ATTEMPTS } from '../utils/twoFactor.js';
import { RESET_CODE_TTL_MS } from '../utils/passwordReset.js';
import { createNotification, getPreferences } from '../utils/notifications.js';
import { createMediaLoader, storeProfilePhoto, toDataUri } from '../utils/media.js';
import { VISIBILITIES, canViewSession, visibleSessionsFilter, visibilityOf } from '../utils/sessionAccess.js';
// Called through the module objects (not destructured) so tests can stub them.
import mailer from '../utils/mailer.js';
import googleAuth from '../utils/googleAuth.js';
import logger from '../utils/logger.js';
import { publishSessionUpdate } from '../realtime.js';

const PROFILE_LIMITS = { name: 50, bio: 300, hometown: 80, sport: 30, sportCount: 10, pictureChars: 200000 };
const MESSAGE_MAX_LENGTH = 2000;
const MESSAGE_PAGE_SIZE = 50;
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_PERIODS = ['MORNING', 'AFTERNOON', 'EVENING'];
const MAX_INVITEES = 49;
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
// FR-8: when a new rating pulls someone's social rating below 2, they can't
// create or join sessions for 2 days.
const SOCIAL_RATING_COOLDOWN = { threshold: 2, durationMs: 48 * HOUR_MS };

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
  if (!authSessions.demoAuthBypassEnabled()) return null;
  const token = await authSessions.createAuthSession(user._id);
  return authSuccess(user, message, { token, requiresTwoFactor: false });
}

// The signed-in user, taken from the request's bearer token. Every operation
// that acts for a user goes through this rather than trusting an ID the
// client sends.
function requireUser(context) {
  if (!context.currentUser) {
    throw new GraphQLError('You must be signed in to do that.', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return context.currentUser;
}

// When the user's social-rating cooldown ends, or null if they aren't in one.
function activeCooldownUntil(user, now = new Date()) {
  const until = user?.cooldownUntil ? new Date(user.cooldownUntil) : null;
  return until && until > now ? until : null;
}

// Rejects create/join while the signed-in user is in a cooldown.
function assertNotInCooldown(user) {
  const until = activeCooldownUntil(user);
  if (until) {
    throw new GraphQLError(
      `Your social rating dropped below ${SOCIAL_RATING_COOLDOWN.threshold}, so you can't create or join sessions until ${until.toISOString()}.`,
      { extensions: { code: 'ACCOUNT_COOLDOWN', cooldownUntil: until.toISOString() } }
    );
  }
}

// profilePhoto is needed to resolve uploaded photos; sportSkills for `sports`.
const PUBLIC_USER_FIELDS = 'name bio hometown profilePicture profilePhoto sports sportSkills skillLevel socialRating';

function publicUserQuery(id) {
  return User.findById(id).select(PUBLIC_USER_FIELDS);
}

function populatedFriendRequestQuery(id) {
  return FriendRequest.findById(id).populate('requester').populate('recipient');
}

// A failed notification must not undo the friend request it is about.
async function notifyFriendActivity(recipient, title, body) {
  try {
    await createNotification({
      recipient,
      type: 'friend_request',
      category: 'friends',
      title,
      body,
      target: { version: 1, screen: 'Friends', params: {} }
    });
  } catch (err) {
    logger.error(err, { context: 'Friend request notification failed', recipientId: String(recipient) });
  }
}

async function createFriendRequest(requesterId, recipientId) {
  if (!mongoose.isValidObjectId(recipientId)) throw new Error('User not found');
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
    await notifyFriendActivity(recipient._id, 'New friend request', `${requester.name} wants to be friends on FieldDay.`);
    return populatedFriendRequestQuery(request._id);
  } catch (err) {
    if (err.code === 11000) throw new Error('A friend request is already pending');
    throw err;
  }
}

function hasParticipant(conversation, userId) {
  return conversation.participants.some((participant) => sameId(participant, userId));
}

async function getAuthorizedConversation(conversationId, user, { allowFormerSession = false } = {}) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new Error('Conversation not found');
  if (conversation.kind === 'session') {
    const session = await Session.findById(conversation.session);
    if (!session) throw new Error('Session not found');
    const isCurrentParticipant = hasParticipant(session, user._id);
    const wasParticipant = hasParticipant(conversation, user._id);
    if (!isCurrentParticipant && !(allowFormerSession && wasParticipant)) {
      throw new Error('You cannot access this conversation');
    }
    return { conversation, session, canSend: isCurrentParticipant };
  }
  if (!hasParticipant(conversation, user._id)) throw new Error('You cannot access this conversation');
  return { conversation, canSend: true };
}

function cleanMessageBody(body) {
  if (typeof body !== 'string') throw new Error('Message must be text');
  const cleaned = body.trim();
  if (!cleaned) throw new Error('Message cannot be empty');
  if (cleaned.length > MESSAGE_MAX_LENGTH) throw new Error(`Message must be ${MESSAGE_MAX_LENGTH} characters or fewer`);
  return cleaned;
}

// Also broadcast over Socket.IO, which skips the GraphQL resolvers, so this
// must already match the Message type's shape.
function serializeMessage(message, userId) {
  const { sender } = message;
  return {
    ...message.toObject(),
    id: String(message._id),
    conversationId: String(message.conversation),
    sender: { id: String(sender._id || sender), name: sender.name, profilePicture: sender.profilePicture },
    createdAt: new Date(message.createdAt).toISOString(),
    mine: sameId(message.sender._id || message.sender, userId),
    read: message.readBy.some((id) => sameId(id, userId))
  };
}

async function ensureSessionConversation(session) {
  return Conversation.findOneAndUpdate(
    { session: session._id },
    { $setOnInsert: { kind: 'session', session: session._id }, $addToSet: { participants: { $each: session.participants } } },
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
  // Session chats are named after the session, not whichever player is listed
  // first, and carry the session so the app can show when and where it is.
  const session = conversation.kind === 'session'
    ? await Session.findById(conversation.session).populate('participants', 'name profilePicture')
    : null;
  return {
    ...conversation.toObject(),
    sessionId: conversation.session ? String(conversation.session) : null,
    session,
    name: conversation.kind === 'session'
      ? (session ? `${session.sport} · ${session.location}` : 'Session chat')
      : (otherNames.join(', ') || 'Direct message'),
    participants,
    messages: messages.map((message) => serializeMessage(message, user._id)),
    unreadCount,
    lastMessageAt: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null
  };
}

// Hidden sessions get the same answer as missing ones, so nobody can find out
// that a private session exists.
function sessionNotFound() {
  return new GraphQLError('Session not found', { extensions: { code: 'NOT_FOUND' } });
}

async function findVisibleSession(sessionId, user) {
  if (!mongoose.isValidObjectId(sessionId)) throw sessionNotFound();
  const session = await Session.findById(sessionId);
  if (!session || !canViewSession(session, user)) throw sessionNotFound();
  return session;
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

// Merges repeated days, drops empty ones and sorts Monday first, so the stored
// schedule has one entry per day the user is free.
function cleanAvailability(availability) {
  const byDay = new Map();
  for (const { day, periods } of availability) {
    const merged = byDay.get(day) || new Set();
    periods.forEach((period) => merged.add(period));
    byDay.set(day, merged);
  }
  return WEEKDAYS
    .filter((day) => byDay.get(day)?.size)
    .map((day) => ({ day, periods: DAY_PERIODS.filter((period) => byDay.get(day).has(period)) }));
}

function sportSkillsOf(user) {
  return user.sportSkills && user.sportSkills.length > 0
    ? user.sportSkills
    : (user.sports || []).map((sport) => ({ sport, skillLevel: user.skillLevel }));
}

// Uploaded photos live in Media (profilePicture is cleared when one is saved);
// older accounts may still have a profilePicture URL.
async function profilePictureOf(user, context) {
  if (!user.profilePhoto) return user.profilePicture || '';
  context.loadMedia ||= createMediaLoader();
  const media = await context.loadMedia(idOf(user.profilePhoto));
  return media ? toDataUri(media) : '';
}

// What first-run setup asks for. A photo, bio and hometown are optional.
const PROFILE_SETUP_REQUIREMENTS = [
  ['name', (user) => Boolean(user.name?.trim())],
  ['sports', (user) => sportSkillsOf(user).length > 0],
  ['availability', (user) => (user.availability || []).some(({ periods }) => periods.length > 0)]
];

function profileSetupMissing(user) {
  return PROFILE_SETUP_REQUIREMENTS.filter(([, isSet]) => !isSet(user)).map(([field]) => field);
}

// Points the profile at a newly uploaded photo ('' removes it). Returns the
// photo it replaced, to delete once the profile is saved.
async function applyProfilePhoto(user, profilePhotoId) {
  const previous = user.profilePhoto;
  if (profilePhotoId === '') {
    user.profilePhoto = null;
  } else {
    const media = mongoose.isValidObjectId(profilePhotoId)
      && await Media.findOne({ _id: profilePhotoId, owner: user._id, purpose: 'profile-photo' }, '_id');
    if (!media) throw new Error('That photo upload has expired. Choose the photo again.');
    user.profilePhoto = media._id;
  }
  user.profilePicture = '';
  return previous && String(previous) !== String(user.profilePhoto) ? previous : null;
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

function sameId(a, b) {
  return idOf(a) === idOf(b);
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
//
// The same update starts a cooldown when this rating pulls the average (rounded,
// as the app shows it) below the threshold. A rating that raises the average
// never starts one and an active cooldown is not extended, so once a cooldown
// ends the user is free until another rating drags them down again.
function applyRatingToUser(userId, value) {
  const { threshold, durationMs } = SOCIAL_RATING_COOLDOWN;
  const newRating = {
    $round: [{ $divide: [{ $add: ['$ratingSum', value] }, { $add: ['$totalRatings', 1] }] }, 1]
  };
  const lowersAverage = {
    $or: [{ $eq: ['$totalRatings', 0] }, { $lt: [{ $multiply: [value, '$totalRatings'] }, '$ratingSum'] }]
  };
  const inCooldown = { $gt: [{ $ifNull: ['$cooldownUntil', null] }, '$$NOW'] };
  return User.updateOne({ _id: userId }, [
    {
      $set: {
        ratingSum: { $add: ['$ratingSum', value] },
        totalRatings: { $add: ['$totalRatings', 1] },
        cooldownUntil: {
          $cond: [
            { $and: [{ $lt: [newRating, threshold] }, lowersAverage, { $not: [inCooldown] }] },
            { $add: ['$$NOW', durationMs] },
            { $ifNull: ['$cooldownUntil', null] }
          ]
        }
      }
    },
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

  const visibility = input.visibility || 'PUBLIC';
  if (!VISIBILITIES.includes(visibility)) throw new Error('Choose who can see this session');
  if (input.inviteeIds?.length && visibility !== 'INVITE_ONLY') {
    throw new Error('Invites are only used for invite-only sessions');
  }

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
    maxParticipants: input.maxParticipants,
    visibility
  };
}

// Checks a list of people a host wants to invite and returns their ids.
async function cleanInvitees(userIds, host) {
  const ids = [...new Set((userIds || []).map(String))].filter((id) => id !== String(host._id));
  if (ids.length > MAX_INVITEES) throw new Error(`You can invite at most ${MAX_INVITEES} people`);
  if (!ids.every((id) => mongoose.isValidObjectId(id))
    || await User.countDocuments({ _id: { $in: ids } }) !== ids.length) {
    throw new Error('Some of the people you invited could not be found');
  }
  return ids;
}

// A session is open to join or leave until it starts.
function openSessionFilter(now = new Date()) {
  return { status: 'upcoming', startsAt: { $gt: now } };
}

function isOpen(session, now = new Date()) {
  return session.status === 'upcoming' && new Date(session.startsAt) > now;
}

// Says why joinSession's guarded update matched nothing.
function joinRejection(session, user) {
  if (!session || !canViewSession(session, user)) return sessionNotFound();
  if (sameId(session.host, user._id)) return new Error('You are hosting this session, so you are already in it');
  if (isParticipant(session, user._id)) return new Error('You have already joined this session');
  if (!isOpen(session)) return new Error('Only upcoming sessions can be joined');
  if (session.participants.length >= session.maxParticipants) return new Error('Session is full');
  return new Error('Could not join this session. Please try again.');
}

function leaveRejection(session, user) {
  if (!session || !canViewSession(session, user)) return sessionNotFound();
  if (sameId(session.host, user._id)) return new Error('The host cannot leave their session');
  if (!isParticipant(session, user._id)) return new Error('You are not in this session');
  if (hasEnded(session)) return new Error('You cannot leave a session that has ended');
  if (!isOpen(session)) return new Error('You cannot leave a session that has already started');
  return new Error('Could not leave this session. Please try again.');
}

// Matches sessions that have ended: by status, by stored end time, or (older
// sessions) 2 hours after they started.
function endedSessionsFilter(now = new Date()) {
  return {
    $or: [
      { status: 'completed' },
      { endsAt: { $lte: now } },
      { endsAt: { $exists: false }, startsAt: { $lte: new Date(now.getTime() - DEFAULT_SESSION_LENGTH_MS) } }
    ]
  };
}

// Two people may become friends once they have played a session together.
// Being on the roster of one that hasn't happened yet isn't enough.
async function havePlayedTogether(userId, otherId) {
  return Boolean(await Session.exists({ participants: { $all: [userId, otherId] }, ...endedSessionsFilter() }));
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

function discoveryQuery(status, input, user) {
  const filter = validateDiscoveryFilter(input);
  const query = { status: status || 'upcoming', ...visibleSessionsFilter(user) };
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
    ratingEligibility: (session, _, context) => ratingEligibility(session, context.currentUser?._id),
    visibility: (session) => visibilityOf(session),
    invitees: async (session, _, context) => {
      if (!context.currentUser || !sameId(session.host, context.currentUser._id)) return [];
      return User.find({ _id: { $in: session.invitees || [] } });
    }
  },

  User: {
    // Only shown to the user themselves.
    cooldownUntil: (user, _, context) => {
      if (!context.currentUser || String(context.currentUser._id) !== String(user._id)) return null;
      return activeCooldownUntil(user)?.toISOString() ?? null;
    },
    // Accounts created before per-sport skill levels only have `sports` and one
    // overall `skillLevel`, so fall back to those.
    sportSkills: (user) => sportSkillsOf(user),
    availability: (user) => user.availability || [],
    profilePicture: (user, _, context) => profilePictureOf(user, context),
    profileComplete: (user) => profileSetupMissing(user).length === 0,
    profileSetupMissing: (user) => profileSetupMissing(user)
  },

  Rating: {
    session: (rating) => String(rating.session),
    ratee: (rating) => String(rating.ratee),
    createdAt: (rating) => new Date(rating.createdAt).toISOString()
  },

  PublicUser: {
    id: (user) => String(user._id || user.id),
    profilePicture: (user, _, context) => profilePictureOf(user, context),
    sports: (user) => sportSkillsOf(user).map(({ sport }) => sport)
  },

  FriendRequest: {
    id: (request) => String(request._id || request.id),
    requester: (request) => request.requester,
    recipient: (request) => request.recipient,
    status: (request) => request.status,
    createdAt: (request) => new Date(request.createdAt).toISOString(),
    updatedAt: (request) => new Date(request.updatedAt).toISOString()
  },

  // Conversations and messages are spread from toObject(), which drops the
  // `id` virtual, so ids come from `_id` here.
  Conversation: {
    id: (conversation) => String(conversation._id)
  },

  ChatParticipant: {
    id: (participant) => String(participant.id ?? participant._id)
  },

  Message: {
    id: (message) => String(message._id),
    conversationId: (message) => String(message.conversation),
    createdAt: (message) => new Date(message.createdAt).toISOString()
  },
  
  Notification: {
    target: (notification) => ({
      ...notification.target,
      params: JSON.stringify(notification.target.params || {})
    }),
    readAt: (notification) => notification.readAt && new Date(notification.readAt).toISOString(),
    createdAt: (notification) => new Date(notification.createdAt).toISOString()
  },

  NotificationDevice: {
    id: (device) => String(device._id),
    lastSeenAt: (device) => new Date(device.lastSeenAt).toISOString()
  },

  Query: {
    me: async (_, __, context) => (context.currentUser ? User.findById(context.currentUser._id).populate('friends') : null),

    getRatingsForUser: async (_, { userId }) => Rating.find({ ratee: userId }).sort({ createdAt: -1 }),

    getRatingsBySession: async (_, { sessionId }, context) => {
      const user = requireUser(context);
      return Rating.find({ session: sessionId, rater: user._id });
    },

    getConversations: async (_, __, context) => {
      const user = requireUser(context);
      const sessions = await Session.find({ participants: user._id }).select('_id participants');
      await Promise.all(sessions.map(ensureSessionConversation));
      const conversations = await Conversation.find({
        $or: [{ participants: user._id }, { session: { $in: sessions.map(({ _id }) => _id) } }]
      }).sort({ lastMessageAt: -1, createdAt: -1 });
      return Promise.all(conversations.map((conversation) => conversationView(conversation, user)));
    },

    getConversation: async (_, { conversationId }, context) => {
      const user = requireUser(context);
      const access = await getAuthorizedConversation(conversationId, user, { allowFormerSession: true });
      return conversationView(access.conversation, user);
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

    getSession: async (_, { id }, context) => {
      const session = await findVisibleSession(id, context.currentUser);
      return populatedSessionQuery(session._id);
    },
    getUser: async (_, { id }) => {
      return User.findById(id).populate('friends');
    },

    checkEmailExists: async (_, { email }) => {
      const user = await User.findOne({ email: normalizeEmail(email) });
      return user
        ? { exists: true, message: 'An account with this email already exists. Please log in instead.' }
        : { exists: false, message: null };
    },

    getSessions: async (_, { status, filter: input }, context) => {
      const { query, filter } = discoveryQuery(status, input, context.currentUser);
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

    getCompletedSessions: async (_, __, context) => {
      const userId = requireUser(context)._id;
      return Session.find({
        ...endedSessionsFilter(),
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
    },

    findUserById: async (_, { id }, context) => {
      requireUser(context);
      // A mistyped ID is just "not found", not a database cast error.
      if (!mongoose.isValidObjectId(id)) return null;
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
      // Stored status stays "upcoming" after a session ends, so match by end time.
      const sessions = await Session.find({ participants: user._id, ...endedSessionsFilter() }, 'participants');
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
        .select(PUBLIC_USER_FIELDS);
    },
    
    getNotifications: async (_, { limit, before }, context) => {
      const user = requireUser(context);
      const query = { recipient: user._id };
      if (before) query.createdAt = { $lt: new Date(before) };
      return Notification.find(query).sort({ createdAt: -1 }).limit(Math.min(limit, 100));
    },

    getUnreadNotificationCount: async (_, __, context) => {
      const user = requireUser(context);
      return Notification.countDocuments({ recipient: user._id, readAt: null });
    },

    getNotificationPreferences: async (_, __, context) => getPreferences(requireUser(context)._id),

    getNotificationDevices: async (_, __, context) => {
      const user = requireUser(context);
      return DeviceToken.find({ user: user._id }).sort({ lastSeenAt: -1 });
    }
  },

  Mutation: {
    createSession: async (_, { input }, context) => {
      const host = requireUser(context);
      assertNotInCooldown(host);
      const { assertCanRegister, recordRegistration } = await getParticipationLimits();
      await assertCanRegister(host);
      const fields = formatSessionInput(input);
      const invitees = await cleanInvitees(input.inviteeIds, host);
      const session = await Session.create({
        ...fields,
        invitees,
        host: host._id,
        participants: [host._id],
        status: 'upcoming'
      });
      try {
        await recordRegistration(session._id, host._id);
      } catch (error) {
        await Session.deleteOne({ _id: session._id });
        throw error;
      }
      publishSessionUpdate(session._id, 'created');
      return populatedSessionQuery(session._id);
    },

    joinSession: async (_, { sessionId }, context) => {
      const user = requireUser(context);
      assertNotInCooldown(user);
      const { assertCanRegister, recordRegistration } = await getParticipationLimits();
      await assertCanRegister(user);
      if (!mongoose.isValidObjectId(sessionId)) throw sessionNotFound();
      // The open-spot check is part of the update's filter, so checking and
      // writing are one step: two people can't both take the last spot, even if
      // both saw it open on a stale screen.
      const joined = await Session.findOneAndUpdate(
        {
          $and: [
            { _id: sessionId, host: { $ne: user._id }, participants: { $ne: user._id } },
            openSessionFilter(),
            { $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] } },
            visibleSessionsFilter(user)
          ]
        },
        { $push: { participants: user._id } },
        { returnDocument: 'after' }
      );
      if (!joined) throw joinRejection(await Session.findById(sessionId), user);
      try {
        await recordRegistration(joined._id, user._id);
      } catch (error) {
        await Session.updateOne({ _id: joined._id }, { $pull: { participants: user._id } });
        throw error;
      }
      publishSessionUpdate(sessionId, 'joined');
      return populatedSessionQuery(sessionId);
    },

    leaveSession: async (_, { sessionId }, context) => {
      const user = requireUser(context);
      if (!mongoose.isValidObjectId(sessionId)) throw sessionNotFound();
      // $pull rather than saving a filtered copy, so a join landing at the same
      // moment isn't overwritten.
      const left = await Session.findOneAndUpdate(
        { _id: sessionId, participants: user._id, host: { $ne: user._id }, ...openSessionFilter() },
        { $pull: { participants: user._id } },
        { returnDocument: 'after' }
      );
      if (!left) throw leaveRejection(await Session.findById(sessionId), user);
      publishSessionUpdate(sessionId, 'left');
      return populatedSessionQuery(sessionId);
    },

    inviteToSession: async (_, { sessionId, userIds }, context) => {
      const user = requireUser(context);
      const session = await findVisibleSession(sessionId, user);
      if (!sameId(session.host, user._id)) throw new Error('Only the host can invite people');
      if (visibilityOf(session) !== 'INVITE_ONLY') throw new Error('Invites are only used for invite-only sessions');
      if (hasEnded(session)) throw new Error('This session has ended');
      const invitees = await cleanInvitees(userIds, user);
      if (new Set([...session.invitees.map(String), ...invitees]).size > MAX_INVITEES) {
        throw new Error(`You can invite at most ${MAX_INVITEES} people`);
      }
      await Session.updateOne({ _id: session._id }, { $addToSet: { invitees: { $each: invitees } } });
      return populatedSessionQuery(session._id);
    },

    uninviteFromSession: async (_, { sessionId, userId }, context) => {
      const user = requireUser(context);
      const session = await findVisibleSession(sessionId, user);
      if (!sameId(session.host, user._id)) throw new Error('Only the host can change invites');
      if (mongoose.isValidObjectId(userId)) {
        await Session.updateOne({ _id: session._id }, { $pull: { invitees: userId } });
      }
      return populatedSessionQuery(session._id);
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

    submitRatings: async (_, { sessionId, ratings }, context) => {
      const raterId = requireUser(context)._id;
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
      await notifyFriendActivity(request.requester, 'Friend request accepted', `${user.name} accepted your friend request.`);
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

    // Friends can see each other's friends-only sessions, so this is limited
    // to people you have actually played with.
    addFriend: async (_, { friendId }, context) => {
      const user = requireUser(context);
      if (sameId(friendId, user._id)) throw new Error('You cannot add yourself as a friend');
      const friend = mongoose.isValidObjectId(friendId) && await User.findById(friendId);
      if (!friend) throw new Error('User not found');
      if (!(await havePlayedTogether(user._id, friend._id))) {
        throw new Error('You can only add people you have played a session with');
      }

      await Promise.all([
        User.updateOne({ _id: user._id }, { $addToSet: { friends: friend._id } }),
        User.updateOne({ _id: friend._id }, { $addToSet: { friends: user._id } })
      ]);
      return User.findById(user._id).populate('friends');
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

      if (authSessions.demoAuthBypassEnabled()) {
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

    uploadProfilePhoto: async (_, { image }, context) => {
      const user = requireUser(context);
      const media = await storeProfilePhoto(user._id, image);
      return { id: String(media._id), contentType: media.contentType };
    },

    updateProfile: async (_, { input }, context) => {
      const user = requireUser(context);

      const name = cleanProfileText(input.name, 'Name', PROFILE_LIMITS.name, { required: true });
      const bio = cleanProfileText(input.bio, 'Bio', PROFILE_LIMITS.bio);
      const hometown = cleanProfileText(input.hometown, 'Hometown', PROFILE_LIMITS.hometown);
      const sportSkills = input.sportSkills ? cleanSportSkills(input.sportSkills) : undefined;
      const availability = input.availability ? cleanAvailability(input.availability) : undefined;
      const replacedPhoto = input.profilePhotoId !== undefined && input.profilePhotoId !== null
        ? await applyProfilePhoto(user, input.profilePhotoId)
        : null;

      if (name !== undefined) user.name = name;
      if (bio !== undefined) user.bio = bio;
      if (hometown !== undefined) user.hometown = hometown;
      if (availability !== undefined) user.availability = availability;
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
      if (user.profilePhoto) await Media.updateOne({ _id: user.profilePhoto }, { $set: { expiresAt: null } });
      if (replacedPhoto) await Media.deleteOne({ _id: replacedPhoto, owner: user._id });
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
      const access = await getAuthorizedConversation(conversationId, user, { allowFormerSession: true });
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
    },
    markNotificationRead: async (_, { id }, context) => {
      const user = requireUser(context);
      const notification = await Notification.findOneAndUpdate(
        { _id: id, recipient: user._id, readAt: null },
        { $set: { readAt: new Date() } },
        { new: true }
      );
      if (notification) return notification;
      const existing = await Notification.findOne({ _id: id, recipient: user._id });
      if (!existing) throw new Error('Notification not found');
      return existing;
    },

    markAllNotificationsRead: async (_, __, context) => {
      const user = requireUser(context);
      const result = await Notification.updateMany(
        { recipient: user._id, readAt: null },
        { $set: { readAt: new Date() } }
      );
      return result.modifiedCount;
    },

    registerNotificationDevice: async (_, { token, platform }, context) => {
      const user = requireUser(context);
      if (!['ios', 'android'].includes(platform)) throw new Error('Unsupported notification platform');
      return DeviceToken.findOneAndUpdate(
        { token },
        { $set: { user: user._id, platform, enabled: true, lastSeenAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    },

    unregisterNotificationDevice: async (_, { token }, context) => {
      const user = requireUser(context);
      const result = await DeviceToken.updateOne(
        { token, user: user._id },
        { $set: { enabled: false, lastSeenAt: new Date() } }
      );
      return result.modifiedCount > 0;
    },

    updateNotificationPreferences: async (_, values, context) => {
      const user = requireUser(context);
      const preferences = await getPreferences(user._id);
      const updates = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => key !== 'user' && value !== undefined)
      );
      Object.assign(preferences, updates, { updatedAt: new Date() });
      return preferences.save();
    }
  }
};

export default resolvers;
