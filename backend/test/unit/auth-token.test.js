import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthToken, setAuthToken, subscribeAuthToken } from '../../../frontend/src/authToken.js';

test('token subscribers are notified on sign-in and sign-out and can unsubscribe', () => {
  const changes = [];
  const unsubscribe = subscribeAuthToken((token) => changes.push(token));
  setAuthToken('test-token');
  assert.equal(getAuthToken(), 'test-token');
  setAuthToken(null);
  unsubscribe();
  setAuthToken('another-token');
  assert.deepEqual(changes, ['test-token', null]);
  setAuthToken(null);
});
