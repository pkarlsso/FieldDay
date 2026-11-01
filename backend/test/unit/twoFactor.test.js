// Unit tests for the emailed 2FA code (issues #17, #18).
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { CODE_TTL_MS, MAX_ATTEMPTS, generateCode, hashCode } from '../../src/utils/twoFactor.js';

describe('generateCode', () => {
  it('always returns six digits as a string', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateCode();
      assert.equal(typeof code, 'string');
      assert.match(code, /^\d{6}$/);
    }
  });

  it('keeps leading zeros on small numbers', (t) => {
    t.after(() => mock.restoreAll());
    mock.method(crypto, 'randomInt', () => 42);
    assert.equal(generateCode(), '000042');
  });

  it('uses the full 000000-999999 range from a secure source', (t) => {
    t.after(() => mock.restoreAll());
    const randomInt = mock.method(crypto, 'randomInt', () => 999999);
    assert.equal(generateCode(), '999999');
    assert.deepEqual(randomInt.mock.calls[0].arguments, [0, 1000000]);
  });
});

describe('hashCode', () => {
  it('is a SHA-256 hex digest that does not contain the code', () => {
    const hash = hashCode('123456');
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.ok(!hash.includes('123456'));
  });

  it('gives the same hash for the same code, so a submitted code can be checked', () => {
    assert.equal(hashCode('061204'), hashCode('061204'));
  });

  it('gives different hashes for different codes', () => {
    assert.notEqual(hashCode('061204'), hashCode('061205'));
    assert.notEqual(hashCode('061204'), hashCode('61204'));
  });
});

describe('2FA limits', () => {
  it('expires a code after 10 minutes and allows 5 attempts', () => {
    assert.equal(CODE_TTL_MS, 10 * 60 * 1000);
    assert.equal(MAX_ATTEMPTS, 5);
  });
});
