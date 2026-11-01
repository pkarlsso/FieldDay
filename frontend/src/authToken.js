// In-memory copy of the signed-in user's session token. Kept in its own module
// so api.js can attach it to requests without importing session.js (which
// itself calls the API).
let authToken = null;
const listeners = new Set();

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
  listeners.forEach((listener) => listener(token));
}

export function subscribeAuthToken(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
