import { Server } from 'socket.io';
import Session from './models/Session.js';
import logger from './utils/logger.js';

// Live session updates over Socket.IO (see doc/realtime.md).
//
// The server only says *which* session changed and why. Clients refetch the
// session through GraphQL, so what they get back still goes through the same
// rules as any other request, and a client that missed events while it was
// disconnected just refetches everything when it reconnects.
const SESSION_UPDATED = 'session:updated';
// How often the clock check looks for sessions that started or ended.
const CLOCK_INTERVAL_MS = 30 * 1000;

let io = null;
let clockTimer = null;
let lastClockCheck = null;

function attachRealtime(httpServer, { allowOrigin = () => true } = {}) {
  io = new Server(httpServer, {
    cors: { origin: true },
    // Browsers send an Origin header; native apps don't. Apply the same rule
    // as the GraphQL route so other websites can't open connections.
    allowRequest: (req, callback) => callback(null, allowOrigin(req.headers.origin, req))
  });
  return io;
}

function closeRealtime() {
  stopSessionClock();
  const closing = io;
  io = null;
  return closing ? closing.close() : undefined;
}

// reason: "created", "joined", "left", "started" or "ended".
function publishSessionUpdate(sessionId, reason) {
  if (!io || !sessionId) return;
  io.emit(SESSION_UPDATED, { sessionId: String(sessionId), reason, at: new Date().toISOString() });
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
  for (const session of sessions) {
    const ended = session.endsAt && session.endsAt > since && session.endsAt <= now;
    publishSessionUpdate(session._id, ended ? 'ended' : 'started');
  }
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
