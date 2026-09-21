/* global console, fetch */
import mongoose from 'mongoose';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getConfig } = require('../backend/src/config.js');
const User = require('../backend/src/models/User.js');
const Session = require('../backend/src/models/Session.js');
const SessionRegistration = (await import('../backend/src/models/SessionRegistration.mjs')).default;
const { createAuthSession } = require('../backend/src/utils/authSession.js');

const endpoint = `http://localhost:${getConfig().port}/graphql`;

async function graphql(query, variables, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((error) => error.message).join('; '));
  return body.data;
}

const tag = `integration-${Date.now()}`;
let host;
let guest;
let sessionId;

try {
  await mongoose.connect(getConfig().mongoUri);
  [host, guest] = await User.create([
    { name: 'Integration Host', email: `${tag}-host@example.test`, socialRating: 4.5 },
    { name: 'Integration Guest', email: `${tag}-guest@example.test`, socialRating: 4.5 }
  ]);
  const hostToken = await createAuthSession(host._id);
  const guestToken = await createAuthSession(guest._id);

  const created = await graphql(
    'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id startsAt location locationPoint{coordinates} participants{id}}}',
    {
      hostId: String(host._id),
      input: {
        sport: 'Pickleball',
        startsAt: '2026-10-01T22:00:00.000Z',
        location: 'Station 21 West Lafayette',
        locationPoint: { longitude: -86.9147, latitude: 40.4259 },
        skillRange: '2.0-4.0',
        maxParticipants: 2
      }
    },
    hostToken
  );
  sessionId = created.createSession.id;
  if (created.createSession.participants.length !== 1) throw new Error('host was not added');
  if (created.createSession.startsAt !== '2026-10-01T22:00:00.000Z') throw new Error('timestamp was not returned as ISO');
  if (created.createSession.locationPoint.coordinates.join(',') !== '-86.9147,40.4259') throw new Error('GeoJSON coordinates were not stored');

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
  if (left.leaveSession.participants.length !== 1) throw new Error('guest was not removed');

  console.log('Integration session test passed: create -> join -> leave');
} finally {
  if (sessionId) {
    await SessionRegistration.deleteMany({ session: sessionId });
    await Session.deleteOne({ _id: sessionId });
  }
  if (host || guest) await User.deleteMany({ _id: { $in: [host?._id, guest?._id].filter(Boolean) } });
  await mongoose.disconnect();
}
