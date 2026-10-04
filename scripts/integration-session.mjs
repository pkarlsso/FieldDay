import mongoose from 'mongoose';
import { getConfig } from '../backend/src/config.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';

const endpoint = `http://localhost:${getConfig().port}/graphql`;

async function graphql(query, variables) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((error) => error.message).join('; '));
  return body.data;
}

const tag = `integration-${Date.now()}`;
let host;
let guest;
let overflowGuest;
let sessionId;

async function expectGraphqlError(query, variables, expectedMessage) {
  try {
    await graphql(query, variables);
    throw new Error(`Expected GraphQL error: ${expectedMessage}`);
  } catch (error) {
    if (!error.message.includes(expectedMessage)) throw error;
  }
}

try {
  await mongoose.connect(getConfig().mongoUri);
  [host, guest, overflowGuest] = await User.create([
    { name: 'Integration Host', email: `${tag}-host@example.test` },
    { name: 'Integration Guest', email: `${tag}-guest@example.test` },
    { name: 'Integration Overflow Guest', email: `${tag}-overflow@example.test` }
  ]);

  await expectGraphqlError(
    'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id}}',
    {
      hostId: String(host._id),
      input: {
        sport: 'Pickleball',
        startsAt: 'not-a-date',
        location: 'Station 21 West Lafayette',
        locationPoint: { longitude: -86.9147, latitude: 40.4259 },
        skillRange: '2.0-4.0',
        maxParticipants: 2
      }
    },
    'startsAt must be a valid ISO date'
  );

  await expectGraphqlError(
    'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id}}',
    {
      hostId: String(host._id),
      input: {
        sport: 'Pickleball',
        startsAt: '2026-10-01T22:00:00.000Z',
        location: 'Station 21 West Lafayette',
        locationPoint: { longitude: -200, latitude: 40.4259 },
        skillRange: '2.0-4.0',
        maxParticipants: 2
      }
    },
    'locationPoint coordinates are out of range'
  );

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
    }
  );
  sessionId = created.createSession.id;
  if (created.createSession.participants.length !== 1) throw new Error('host was not added');
  if (created.createSession.startsAt !== '2026-10-01T22:00:00.000Z') throw new Error('timestamp was not returned as ISO');
  if (created.createSession.locationPoint.coordinates.join(',') !== '-86.9147,40.4259') throw new Error('GeoJSON coordinates were not stored');

  try {
    await graphql(
      'mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){id}}',
      { sessionId, userId: String(host._id) }
    );
    throw new Error('host was allowed to leave');
  } catch (error) {
    if (!error.message.includes('host cannot leave')) throw error;
  }

  const joined = await graphql(
    'mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){participants{id}}}',
    { sessionId, userId: String(guest._id) }
  );
  if (joined.joinSession.participants.length !== 2) throw new Error('guest was not added');

  await expectGraphqlError(
    'mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){id}}',
    { sessionId, userId: String(overflowGuest._id) },
    'Session is full'
  );

  const duplicate = await graphql(
    'mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){participants{id}}}',
    { sessionId, userId: String(guest._id) }
  );
  if (duplicate.joinSession.participants.length !== 2) throw new Error('duplicate join changed roster');

  const left = await graphql(
    'mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){participants{id}}}',
    { sessionId, userId: String(guest._id) }
  );
  if (left.leaveSession.participants.length !== 1) throw new Error('guest was not removed');

  console.log('Integration session test passed: create -> join -> leave');
} finally {
  if (sessionId) await Session.deleteOne({ _id: sessionId });
  if (host || guest || overflowGuest) {
    await User.deleteMany({ _id: { $in: [host?._id, guest?._id, overflowGuest?._id].filter(Boolean) } });
  }
  await mongoose.disconnect();
}
