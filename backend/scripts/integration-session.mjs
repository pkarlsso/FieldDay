/* eslint-disable no-console */
// Runs against a backend that is already running on PORT over real HTTP.
import mongoose from 'mongoose';
import { getConfig } from '../src/config.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import SessionRegistration from '../src/models/SessionRegistration.mjs';
import AuthSession from '../src/models/AuthSession.js';
import { createAuthSession } from '../src/utils/authSession.js';

const endpoint = `http://localhost:${getConfig().port}/graphql`;
const tag = `integration-${Date.now()}`;
const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
startsAt.setUTCMinutes(0, 0, 0);
const startsAtIso = startsAt.toISOString();
const tokens = new Map();
let host;
let guest;
let overflowGuest;
let sessionId;

async function graphql(query, variables, user) {
  const headers = { 'content-type': 'application/json' };
  if (user) headers.authorization = `Bearer ${tokens.get(user)}`;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((error) => error.message).join('; '));
  return body.data;
}

async function expectGraphqlError(query, variables, user, expectedMessage) {
  try {
    await graphql(query, variables, user);
    throw new Error(`Expected GraphQL error: ${expectedMessage}`);
  } catch (error) {
    if (!error.message.includes(expectedMessage)) throw error;
  }
}

const CREATE = 'mutation($input:CreateSessionInput!){createSession(input:$input){id startsAt location locationPoint{coordinates} skillLevel maxParticipants host{id} participants{id}}}';
const JOIN = 'mutation($sessionId:ID!){joinSession(sessionId:$sessionId){participants{id}}}';
const LEAVE = 'mutation($sessionId:ID!){leaveSession(sessionId:$sessionId){participants{id}}}';
const input = (overrides = {}) => ({
  sport: 'Pickleball',
  startsAt: startsAtIso,
  location: 'Station 21 West Lafayette',
  locationPoint: { longitude: -86.9147, latitude: 40.4259 },
  skillLevel: 2,
  maxParticipants: 2,
  ...overrides
});

try {
  await mongoose.connect(getConfig().mongoUri);
  [host, guest, overflowGuest] = await User.create([
    { name: 'Integration Host', email: `${tag}-host@example.test`, socialRating: 4.5 },
    { name: 'Integration Guest', email: `${tag}-guest@example.test`, socialRating: 4.5 },
    { name: 'Integration Overflow Guest', email: `${tag}-overflow@example.test`, socialRating: 4.5 }
  ]);
  for (const user of [host, guest, overflowGuest]) tokens.set(user, await createAuthSession(user._id));

  await expectGraphqlError(CREATE, { input: input() }, null, 'must be signed in');
  await expectGraphqlError(CREATE, { input: input({ startsAt: 'not-a-date' }) }, host, 'startsAt must be a valid ISO date');
  await expectGraphqlError(CREATE, { input: input({ locationPoint: { longitude: -200, latitude: 40.4259 } }) }, host, 'locationPoint coordinates are out of range');

  const created = await graphql(CREATE, { input: input() }, host);
  sessionId = created.createSession.id;
  if (created.createSession.host.id !== String(host._id)) throw new Error('host was not taken from the token');
  if (created.createSession.participants.length !== 1) throw new Error('host was not added');
  if (created.createSession.startsAt !== startsAtIso) throw new Error('timestamp was not returned as ISO');
  if (created.createSession.locationPoint.coordinates.join(',') !== '-86.9147,40.4259') throw new Error('GeoJSON coordinates were not stored');
  if (created.createSession.skillLevel !== 2 || created.createSession.maxParticipants !== 2) throw new Error('capacity and skill level were not stored');

  await expectGraphqlError(LEAVE, { sessionId }, host, 'host cannot leave');
  await expectGraphqlError(JOIN, { sessionId }, host, 'You are hosting this session');
  await expectGraphqlError(JOIN, { sessionId }, null, 'must be signed in');

  const joined = await graphql(JOIN, { sessionId }, guest);
  if (joined.joinSession.participants.length !== 2) throw new Error('guest was not added');
  await expectGraphqlError(JOIN, { sessionId }, overflowGuest, 'Session is full');
  await expectGraphqlError(JOIN, { sessionId }, guest, 'already joined');
  await expectGraphqlError(LEAVE, { sessionId }, overflowGuest, 'not in this session');

  const left = await graphql(LEAVE, { sessionId }, guest);
  if (left.leaveSession.participants.length !== 1) throw new Error('guest was not removed');
  const rejoined = await graphql(JOIN, { sessionId }, overflowGuest);
  if (rejoined.joinSession.participants.length !== 2) throw new Error('the freed spot could not be taken');

  console.log('Integration session test passed: create -> join -> leave over HTTP with bearer tokens');
} finally {
  if (sessionId) {
    await SessionRegistration.deleteMany({ session: sessionId });
    await Session.deleteOne({ _id: sessionId });
  }
  const userIds = [host?._id, guest?._id, overflowGuest?._id].filter(Boolean);
  if (userIds.length) {
    await AuthSession.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  }
  await mongoose.disconnect();
}
