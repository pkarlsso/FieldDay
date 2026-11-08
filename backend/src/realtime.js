import { Server } from 'socket.io';
import Session from './models/Session.js';
import User from './models/User.js';
import logger from './utils/logger.js';
import { visibilityOf } from './utils/sessionAccess.js';

// Live session updates over Socket.IO (see doc/realtime.md).
//
// The server only says *which* session changed and why. Clients refetch the
// session through GraphQL, so what they get back still goes through the same
// rules as any other request, and a client that missed events while it was
// disconnected just refetches everything when it reconnects.
//
// Even an id and a reason say that a session exists and when people join it,
// so events for friends-only and invite-only sessions only go to the people
// who may see that session. Each signed-in connection joins a room named after
// its user for this.
const SESSION_UPDATED = 'session:updated';
// How often the clock check looks for sessions that started or ended.
const CLOCK_INTERVAL_MS = 30 * 1000;

let io = null;
let clockTimer = null;
let lastClockCheck = null;

const userRoom = (userId) => `user:${userId}`;

// `authenticate(token)` returns the signed-in user for a connection's token, or
// null. Connections without a valid token still get public-session updates.
function attachRealtime(httpServer, { allowOrigin = () => true, authenticate = async () => null } = {}) {
  io = new Server(httpServer, {
    cors: { origin: true },
    // Browsers send an Origin header; native apps don't. Apply the same rule
    // as the GraphQL route so other websites can't open connections.
    allowRequest: (req, callback) => callback(null, allowOrigin(req.headers.origin, req))
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.currentUser = token ? await authenticate(token) : null;
      if (socket.currentUser) socket.join(userRoom(socket.currentUser._id));
      return next();
    } catch (error) {
      return next(error);
    }
  });
  return io;
}

// Everyone who may see a private session, by the same rule as canViewSession:
// the host, the players, and the host's friends or the invitees. Friendships
// are stored on both users, so the host's friends list is enough.
async function privateAudience(session) {
  const userIds = [session.host, ...(session.participants || [])];
  if (visibilityOf(session) === 'FRIENDS') {
    const host = await User.findById(session.host, 'friends');
    userIds.push(...(host?.friends || []));
  } else {
    userIds.push(...(session.invitees || []));
  }
  return userIds;
}

async function sendSessionUpdate(sessionId, reason, alsoNotify) {
  const session = await Session.findById(sessionId, 'visibility host participants invitees');
  if (!io || !session) return;
  const event = { sessionId: String(sessionId), reason, at: new Date().toISOString() };
  if (visibilityOf(session) === 'PUBLIC') {
    io.emit(SESSION_UPDATED, event);
    return;
  }
  const rooms = [...new Set([...(await privateAudience(session)), ...alsoNotify].map((id) => userRoom(String(id))))];
  // io.to([]) would reach every connection, so never call it with no rooms.
  if (rooms.length) io.to(rooms).emit(SESSION_UPDATED, event);
}

function closeRealtime() {
  stopSessionClock();
  const closing = io;
  io = null;
  return closing ? closing.close() : undefined;
}

// reason: "created", "edited", "cancelled", "joined", "left", "invalid",
// "started" or "ended". `alsoNotify` lists users to tell even though they can
// no longer see a private session, such as a player who just left it.
// Callers don't wait for it; a failed lookup is logged and the event dropped.
function publishSessionUpdate(sessionId, reason, { alsoNotify = [] } = {}) {
  if (!io || !sessionId) return Promise.resolve();
  return sendSessionUpdate(sessionId, reason, alsoNotify)
    .catch((err) => logger.error('Session update could not be sent', { sessionId: String(sessionId), error: err.message }));
}

// Sessions start and end by the clock rather than through a mutation, so check
// for sessions that crossed either line since the last check. Starting matters
// because the session drops out of Explore; ending closes it to joins.
async function checkSessionClock(now = new Date()) {
  const since = lastClockCheck || new Date(now.getTime() - CLOCK_INTERVAL_MS);
  lastClockCheck = now;
  const sessions = await Session.find({
    $or: [
      { startsAt: { $gt: since, $lte: now } },
      { endsAt: { $gt: since, $lte: now } }
    ]
  }, { startsAt: 1, endsAt: 1 });
  await Promise.all(sessions.map((session) => {
    const ended = session.endsAt && session.endsAt > since && session.endsAt <= now;
    return publishSessionUpdate(session._id, ended ? 'ended' : 'started');
  }));
  return sessions.length;
}

function startSessionClock() {
  stopSessionClock();
  lastClockCheck = new Date();
  clockTimer = setInterval(() => {
    checkSessionClock().catch((err) => logger.error('Session clock check failed', { error: err.message }));
  }, CLOCK_INTERVAL_MS);
  clockTimer.unref?.();
}

function stopSessionClock() {
  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
  lastClockCheck = null;
}

export {
  SESSION_UPDATED,
  attachRealtime,
  closeRealtime,
  publishSessionUpdate,
  checkSessionClock,
  startSessionClock,
  stopSessionClock
};
