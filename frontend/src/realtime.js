import { io } from 'socket.io-client';
import { getAuthToken } from './authToken';
import { REALTIME_URL } from './config';
import logger from './logger';

// One Socket.IO connection for the whole app, opened when the first screen
// subscribes. The server only says which session changed; screens refetch it
// through GraphQL (see doc/realtime.md).
//
// Listeners get either { sessionId, reason } for one session, or
// { resync: true } after the connection drops and comes back, since anything
// that changed in between was missed and the screen should refetch it all.
const listeners = new Set();
let socket = null;
// The sign-in token the connection was opened with. Updates for private
// sessions only reach signed-in users who may see them, so a connection made
// before signing in (or as someone else) is reopened with the current token.
let socketToken = null;

function notify(event) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      logger.error('Session update listener failed:', err);
    }
  });
}

function connect() {
  if (socket && socketToken === getAuthToken()) return;
  disconnect();
  socketToken = getAuthToken();
  // Starts with HTTP long-polling and upgrades to a WebSocket when the network
  // allows it, so it still works behind proxies that don't pass WebSockets.
  socket = io(REALTIME_URL, { reconnectionDelayMax: 10000, auth: { token: socketToken } });
  let connectedBefore = false;
  socket.on('connect', () => {
    if (connectedBefore) notify({ resync: true });
    connectedBefore = true;
  });
  socket.on('session:updated', (event) => notify(event));
  socket.on('connect_error', (err) => logger.warn('Live session updates unavailable:', err.message));
}

function disconnect() {
  socket?.disconnect();
  socket = null;
}

export function subscribeToSessionUpdates(listener) {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
}
