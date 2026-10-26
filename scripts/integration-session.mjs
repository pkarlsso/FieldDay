// Runs against a backend that is already running on PORT, over real HTTP, so
// it also checks that the Authorization header decides who the user is.
import mongoose from 'mongoose';
import { getConfig } from '../backend/src/config.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import SessionRegistration from '../backend/src/models/SessionRegistration.js';
import AuthSession from '../backend/src/models/AuthSession.js';
import { createAuthSession } from '../backend/src/utils/authSession.js';

const endpoint = `http://localhost:${getConfig().port}/graphql`;

async function graphql(query, variables, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
// `user` signs the request with that user's token; leave it out to send none.
async function graphql(query, variables, user) {
  const headers = { 'content-type': 'application/json' };
  if (user) headers.authorization = `Bearer ${tokens.get(user)}`;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((error) => error.message).join('; '));
  return body.data;
}

const tag = `integration-${Date.now()}`;
// Sessions must start in the future, so build the timestamp relative to now.
const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
startsAt.setUTCMinutes(0, 0, 0);
const startsAtIso = startsAt.toISOString();
const tokens = new Map();
let host;
let guest;
let overflowGuest;
let sessionId;

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

async function expectGraphqlError(query, variables, user, expectedMessage) {
  try {
    await graphql(query, variables, user);
    throw new Error(`Expected GraphQL error: ${expectedMessage}`);
  } catch (error) {
    if (!error.message.includes(expectedMessage)) throw error;
  }
}

try {
  await mongoose.connect(getConfig().mongoUri);
  [host, guest, overflowGuest] = await User.create([
    { name: 'Integration Host', email: `${tag}-host@example.test`, socialRating: 4.5 },
    { name: 'Integration Guest', email: `${tag}-guest@example.test`, socialRating: 4.5 },
    { name: 'Integration Overflow Guest', email: `${tag}-overflow@example.test`, socialRating: 4.5 }
  ]);
  const hostToken = await createAuthSession(host._id);
  const guestToken = await createAuthSession(guest._id);
  for (const user of [host, guest, overflowGuest]) tokens.set(user, await createAuthSession(user._id));

  await expectGraphqlError(CREATE, { input: input() }, null, 'must be signed in');
  await expectGraphqlError(
    'mutation($h:ID!,$input:CreateSessionInput!){createSession(hostId:$h,input:$input){id}}',
    { h: String(guest._id), input: input() },
    host,
    'Unknown argument "hostId"'
  );
  await expectGraphqlError(CREATE, { input: input({ startsAt: 'not-a-date' }) }, host, 'startsAt must be a valid ISO date');
  await expectGraphqlError(CREATE, { input: input({ locationPoint: { longitude: -200, latitude: 40.4259 } }) }, host, 'locationPoint coordinates are out of range');

  await expectGraphqlError(
    'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id}}',
    {
      hostId: String(host._id),
      input: {
        sport: 'Pickleball',
        startsAt: startsAtIso,
        location: 'Station 21 West Lafayette',
        locationPoint: { longitude: -200, latitude: 40.4259 },
        skillLevel: 2,
        maxParticipants: 2
      }
    },
    'locationPoint coordinates are out of range'
  );

  const created = await graphql(
    'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id startsAt location locationPoint{coordinates} skillLevel maxParticipants participants{id}}}',
    {
      hostId: String(host._id),
      input: {
        sport: 'Pickleball',
        startsAt: startsAtIso,
        location: 'Station 21 West Lafayette',
        locationPoint: { longitude: -86.9147, latitude: 40.4259 },
        skillLevel: 2,
        maxParticipants: 2
      }
    },
    hostToken
  );
  const created = await graphql(CREATE, { input: input() }, host);
  sessionId = created.createSession.id;
  if (created.createSession.host.id !== String(host._id)) throw new Error('host was not taken from the token');
  if (created.createSession.participants.length !== 1) throw new Error('host was not added');
  if (created.createSession.startsAt !== startsAtIso) throw new Error('timestamp was not returned as ISO');
  if (created.createSession.locationPoint.coordinates.join(',') !== '-86.9147,40.4259') throw new Error('GeoJSON coordinates were not stored');
  if (created.createSession.skillLevel !== 2 || created.createSession.maxParticipants !== 2) throw new Error('capacity and skill level were not stored');

  try {
    await graphql(
      'mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){id}}',
      { sessionId, userId: String(host._id) },
      hostToken
    );
    throw new Error('host was allowed to leave');
  } catch (error) {
    if (!error.message.includes('host cannot leave')) throw error;
  }

  const joined = await graphql(
    'mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){participants{id}}}',
    { sessionId, userId: String(guest._id) },
    guestToken
  );
  if (joined.joinSession.participants.length !== 2) throw new Error('guest was not added');
  await expectGraphqlError(LEAVE, { sessionId }, host, 'host cannot leave');
  await expectGraphqlError(JOIN, { sessionId }, host, 'You are hosting this session');
  await expectGraphqlError(JOIN, { sessionId }, null, 'must be signed in');

  const joined = await graphql(JOIN, { sessionId }, guest);
  if (joined.joinSession.participants.map((p) => p.id).join() !== [host._id, guest._id].join()) throw new Error('guest was not added');

  await expectGraphqlError(JOIN, { sessionId }, overflowGuest, 'Session is full');
  await expectGraphqlError(JOIN, { sessionId }, guest, 'already joined');
  await expectGraphqlError(LEAVE, { sessionId }, overflowGuest, 'not in this session');

  const duplicate = await graphql(
    'mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){participants{id}}}',
    { sessionId, userId: String(guest._id) },
    guestToken
  );
  if (duplicate.joinSession.participants.length !== 2) throw new Error('duplicate join changed roster');

  const left = await graphql(
    'mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){participants{id}}}',
    { sessionId, userId: String(guest._id) },
    guestToken
  );
  const left = await graphql(LEAVE, { sessionId }, guest);
  if (left.leaveSession.participants.length !== 1) throw new Error('guest was not removed');
  const rejoined = await graphql(JOIN, { sessionId }, overflowGuest);
  if (rejoined.joinSession.participants.length !== 2) throw new Error('the freed spot could not be taken');

  console.log('Integration session test passed: create -> join -> leave over HTTP with bearer tokens');
} finally {
  if (sessionId) await Session.deleteOne({ _id: sessionId });
  const userIds = [host?._id, guest?._id, overflowGuest?._id].filter(Boolean);
  if (userIds.length) {
    await AuthSession.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  }
  await mongoose.disconnect();
}
