import argon2 from 'argon2';

const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';

function validatePasswordStrength(password) {
  if (typeof password !== 'string') return false;
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// argon2.hash() encodes the salt and Argon2id parameters into the returned
// string, so nothing else needs to be stored alongside it to verify later.
function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

function verifyPassword(hash, password) {
  return argon2.verify(hash, password);
}

export { validatePasswordStrength, PASSWORD_REQUIREMENTS, hashPassword, verifyPassword };
