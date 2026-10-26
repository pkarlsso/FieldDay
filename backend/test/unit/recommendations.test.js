import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendSessions, recommendationQuery, validateRecommendationOptions } from '../../src/services/recommendations.js';
import { gorseId, toGorseItem, toGorseUser } from '../../src/services/gorse.js';

test('profile fallback favors a preferred sport and matching skill', () => {
  const user = { sportSkills: [{ sport: 'Basketball', skillLevel: 3 }] };
  const startsAt = new Date(Date.now() + 86400000);
  const sessions = [
    { sport: 'Tennis', startsAt, skillLevel: 2, maxParticipants: 5, participants: [] },
    { sport: 'basketball', startsAt, skillLevel: 2, maxParticipants: 5, participants: [] },
  ];
  const ranked = recommendSessions(sessions, user, null, 2);
  assert.equal(ranked[0].session.sport, 'basketball');
  assert.ok(ranked[0].reasons.includes('Fits your skill level'));
});

test('recommendation candidates enforce visibility and exclude joined sessions', () => {
  const user = { _id: 'viewer', friends: ['friend'] };
  const query = recommendationQuery(user, null, 50);
  assert.deepEqual(query.$and[0].$or, [
    { visibility: { $in: ['PUBLIC', null] } },
    { visibility: 'FRIENDS', host: { $in: ['friend'] } },
    { visibility: 'INVITE_ONLY', invitees: 'viewer' },
  ]);
  assert.deepEqual(query.$and[2], { participants: { $ne: 'viewer' } });
  assert.throws(() => validateRecommendationOptions({ limit: 21 }), /limit/);
});

test('Gorse records use pseudonymous IDs and omit account and location data', () => {
  const user = { _id: 'user-id', email: 'private@example.test', password: 'secret', sports: ['Tennis'] };
  const session = { _id: 'session-id', sport: 'Tennis', location: 'private address', locationPoint: { coordinates: [1, 2] } };
  const gorseUser = toGorseUser(user, 'test-secret');
  const item = toGorseItem(session, 'test-secret');
  assert.equal(gorseUser.UserId, gorseId('user', user._id, 'test-secret'));
  assert.notEqual(gorseUser.UserId, user._id);
  assert.deepEqual(Object.keys(gorseUser).sort(), ['Labels', 'UserId']);
  assert.ok(!JSON.stringify(item).includes('private address'));
  assert.ok(!('locationPoint' in item));
});
