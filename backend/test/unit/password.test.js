// Unit tests for password strength checks and Argon2id hashing (issues #15, #16).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../../src/utils/password.js';

describe('validatePasswordStrength', () => {
  it('accepts a password that meets every rule', () => {
    assert.equal(validatePasswordStrength('Field!Day9'), true);
  });

  it('accepts exactly 8 characters', () => {
    assert.equal(validatePasswordStrength('Abcde1!x'), true);
  });

  it('rejects a password shorter than 8 characters', () => {
    assert.equal(validatePasswordStrength('Ab1!xyz'), false);
  });

  it('rejects a password missing any one character class', () => {
    assert.equal(validatePasswordStrength('fieldday9!'), false, 'no uppercase');
    assert.equal(validatePasswordStrength('FIELDDAY9!'), false, 'no lowercase');
    assert.equal(validatePasswordStrength('FieldDay!!'), false, 'no number');
    assert.equal(validatePasswordStrength('FieldDay99'), false, 'no special character');
  });

  it('counts spaces and unicode symbols as special characters', () => {
    assert.equal(validatePasswordStrength('Field Day9'), true);
    assert.equal(validatePasswordStrength('FieldDay9€'), true);
  });

  it('rejects anything that is not a string', () => {
    for (const value of [undefined, null, 12345678, ['Field!Day9'], { password: 'Field!Day9' }]) {
      assert.equal(validatePasswordStrength(value), false, `${JSON.stringify(value)} should be rejected`);
    }
  });
});

describe('hashPassword and verifyPassword', () => {
  it('stores an Argon2id hash, never the plain password', async () => {
    const hash = await hashPassword('Field!Day9');
    assert.match(hash, /^\$argon2id\$/);
    assert.ok(!hash.includes('Field!Day9'));
  });

  it('salts every hash, so the same password hashes differently', async () => {
    const [first, second] = await Promise.all([hashPassword('Field!Day9'), hashPassword('Field!Day9')]);
    assert.notEqual(first, second);
  });

  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('Field!Day9');
    assert.equal(await verifyPassword(hash, 'Field!Day9'), true);
    assert.equal(await verifyPassword(hash, 'field!day9'), false);
    assert.equal(await verifyPassword(hash, 'Field!Day9 '), false);
    assert.equal(await verifyPassword(hash, ''), false);
  });
});
