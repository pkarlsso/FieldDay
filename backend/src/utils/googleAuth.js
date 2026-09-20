const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();

// GOOGLE_CLIENT_IDS is a comma-separated list of the OAuth client IDs the app
// signs in with (web, iOS and Android each have their own).
function getAllowedAudiences() {
  return (process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

// Verifies a Google ID token's signature, expiry and audience and returns the
// fields we care about. Throws if the token is invalid or Google sign-in is
// not configured on this server.
async function verifyGoogleIdToken(idToken) {
  const audience = getAllowedAudiences();
  if (audience.length === 0) {
    throw new Error('Google sign-in is not configured on this server.');
  }
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name || null
  };
}

module.exports = { verifyGoogleIdToken };
