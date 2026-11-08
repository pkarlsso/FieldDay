import crypto from 'node:crypto';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function generateCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

// The 2FA code is short-lived and rate-limited (MAX_ATTEMPTS), unlike a
// password, so a fast hash is fine here — Argon2id's deliberate slowness
// buys nothing against a 6-digit code that expires in minutes.
function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export { generateCode, hashCode, CODE_TTL_MS, MAX_ATTEMPTS };
