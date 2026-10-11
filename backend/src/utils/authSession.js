import crypto from 'node:crypto';
import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Tokens are 256 bits of randomness, so a plain SHA-256 is enough to store
// them safely (no need for a slow password hash).
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createAuthSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await AuthSession.create({
    user: userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  });
  return token;
}

async function findActiveSession(token) {
  if (typeof token !== 'string' || !token) return null;
  return AuthSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
}

// Called when the app reopens: confirms the token is still good and pushes the
// expiry out another 30 days, so someone who keeps using FieldDay stays signed in.
async function restoreAuthSession(token) {
  const session = await findActiveSession(token);
  if (!session) return null;
  const user = await User.findById(session.user);
  if (!user) {
    await session.deleteOne();
    return null;
  }
  session.lastUsedAt = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await session.save();
  return user;
}

async function revokeAuthSession(token) {
  if (typeof token !== 'string' || !token) return;
  await AuthSession.deleteOne({ tokenHash: hashToken(token) });
}

function revokeAllAuthSessions(userId) {
  return AuthSession.deleteMany({ user: userId });
}

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Resolves the signed-in user for a request, or null. An unknown or expired
// token is treated as "not signed in" rather than an error so public
// operations (login, sign up, ...) keep working with a stale header.
async function authenticateRequest(req) {
  const session = await findActiveSession(readBearerToken(req));
  if (!session) return null;
  return User.findById(session.user);
}

export {
  SESSION_TTL_MS,
  createAuthSession,
  restoreAuthSession,
  revokeAuthSession,
  revokeAllAuthSessions,
  authenticateRequest
};
