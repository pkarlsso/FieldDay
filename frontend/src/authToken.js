// In-memory copy of the signed-in user's session token. Kept in its own module
// so api.js can attach it to requests without importing session.js (which
// itself calls the API).
let authToken = null;

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
}
