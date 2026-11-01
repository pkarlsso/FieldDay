import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { recommendSessions, explainGorseSessions, recommendationQuery, validateRecommendationOptions } from '../../src/services/recommendations.js';
import { gorseId, hasGorseJoins, removeJoin, toGorseItem, toGorseUser } from '../../src/services/gorse.js';

test('cancelled sessions are hidden from Gorse', () => {
  const session = { _id: 'cancelled', sport: 'Tennis', status: 'cancelled', startsAt: new Date(Date.now() + 86400000) };
  assert.equal(toGorseItem(session, 'test-secret').IsHidden, true);
  assert.equal(toGorseItem({ ...session, status: 'upcoming' }, 'test-secret').IsHidden, false);
});

test('leaving removes only that user and session join signal', async () => {
  const previous = { ...process.env };
  process.env.GORSE_BASE_URL = 'http://localhost:8088';
  process.env.GORSE_ID_SECRET = 'test-secret';
  const request = mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 204 }));
  try {
    await removeJoin({ _id: 'user' }, { _id: 'session' });
    assert.equal(request.mock.calls[0].arguments[1].method, 'DELETE');
    assert.equal(request.mock.calls[0].arguments[0], `http://localhost:8088/api/feedback/join/${gorseId('user', 'user', 'test-secret')}/${gorseId('session', 'session', 'test-secret')}`);
  } finally {
    request.mock.restore();
    process.env = previous;
  }
});

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

test('new users use the profile fallback until they have a join signal', async () => {
  const previousUrl = process.env.GORSE_BASE_URL;
  const previousSecret = process.env.GORSE_ID_SECRET;
  process.env.GORSE_BASE_URL = 'http://127.0.0.1:8088';
  process.env.GORSE_ID_SECRET = 'test-secret';
  let feedback = [];
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => feedback,
  }));
  try {
    assert.equal(await hasGorseJoins({ _id: 'new-user' }), false);
    feedback = [{ FeedbackType: 'join' }];
    assert.equal(await hasGorseJoins({ _id: 'new-user' }), true);
  } finally {
    fetchMock.mock.restore();
    if (previousUrl === undefined) delete process.env.GORSE_BASE_URL;
    else process.env.GORSE_BASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.GORSE_ID_SECRET;
    else process.env.GORSE_ID_SECRET = previousSecret;
  }
});


test('Gorse selections outside the fallback top results retain their explanations', () => {
  const user = { sportSkills: [{ sport: 'Basketball', skillLevel: 2 }] };
  const sessions = Array.from({ length: 6 }, (_, i) => ({
    _id: String(i), sport: i === 5 ? 'Tennis' : 'Basketball',
    startsAt: new Date(Date.now() + 86400000), skillLevel: 2, maxParticipants: 5, participants: [],
  }));
  const scored = recommendSessions(sessions, user, null, sessions.length);
  assert.ok(!scored.slice(0, 5).some((entry) => entry.session._id === '5'));
  const [result] = explainGorseSessions([sessions[5]], scored, 1);
  assert.ok(result.reasons.includes('Has open spots'));
  assert.ok(result.reasons.includes('Ranked by Gorse'));
});
