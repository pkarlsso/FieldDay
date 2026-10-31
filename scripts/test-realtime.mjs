// Live roster updates (#207): Socket.IO events after create, join and leave,
// sessions starting and ending, full sessions from stale screens, concurrent
// joins for the last spot, and reconnecting clients.
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { io as connectClient } from 'socket.io-client';
import { getConfig } from '../backend/src/config.js';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import resolvers from '../backend/src/graphql/resolvers.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import SessionRegistration from '../backend/src/models/SessionRegistration.mjs';
import { SESSION_UPDATED, attachRealtime, checkSessionClock, closeRealtime } from '../backend/src/realtime.js';

const tag = `realtime-test-${Date.now()}`;
const emailFor = (name) => `${tag}-${name}@example.test`;
const HOUR = 60 * 60 * 1000;

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

async function run(query, variables = {}, currentUser = null) {
  const { body } = await server.executeOperation({ query, variables }, { contextValue: { currentUser } });
  assert.equal(body.kind, 'single');
  return body.singleResult;
}

async function ok(query, variables, currentUser) {
  const result = await run(query, variables, currentUser);
  assert.equal(result.errors, undefined, `unexpected error: ${result.errors?.[0]?.message}`);
  return JSON.parse(JSON.stringify(result.data));
}

async function fails(query, variables, currentUser, expected) {
  const result = await run(query, variables, currentUser);
  assert.ok(result.errors, `expected an error containing "${expected}"`);
  const message = result.errors[0].message;
  assert.ok(message.includes(expected), `expected "${message}" to include "${expected}"`);
}

const CREATE = 'mutation($input:CreateSessionInput!){createSession(input:$input){id}}';
const JOIN = 'mutation($s:ID!){joinSession(sessionId:$s){id participants{id}}}';
const LEAVE = 'mutation($s:ID!){leaveSession(sessionId:$s){id participants{id}}}';
const GET = 'query($id:ID!){getSession(id:$id){id status maxParticipants participants{id}}}';

const validInput = (overrides = {}) => ({
  sport: 'Pickleball',
  startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
  location: `Realtime Test Court ${tag}`,
  locationPoint: { longitude: -86.9147, latitude: 40.4259 },
  maxParticipants: 3,
  skillLevel: 2,
  ...overrides
});
const idOf = (user) => String(user._id);

// Records every session:updated event a client receives, so tests can wait for
// a specific one without racing the network.
function watch(client) {
  const events = [];
  const waiters = new Set();
  client.on(SESSION_UPDATED, (event) => {
    events.push(event);
    for (const waiter of waiters) waiter();
  });
  return {
    events,
    next(sessionId, reason, timeoutMs = 5000) {
      const find = () => events.find((event) => event.sessionId === sessionId && event.reason === reason);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(check);
          reject(new Error(`no "${reason}" event for ${sessionId} within ${timeoutMs}ms`));
        }, timeoutMs);
        function check() {
          const match = find();
          if (!match) return;
          clearTimeout(timer);
          waiters.delete(check);
          resolve(match);
        }
        waiters.add(check);
        check();
      });
    }
  };
}

function connected(client) {
  return client.connected ? Promise.resolve() : new Promise((resolve) => client.once('connect', resolve));
}

const createdEmails = [];
const httpServer = http.createServer();
attachRealtime(httpServer);
await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${httpServer.address().port}`;
// One client upgrades to a WebSocket; the other stays on HTTP long-polling,
// which is what gets through proxies that don't pass WebSockets.
const viewerA = connectClient(url, { reconnectionDelay: 100 });
const viewerB = connectClient(url, { transports: ['polling'] });
const a = watch(viewerA);
const b = watch(viewerB);

try {
  await mongoose.connect(getConfig().mongoUri);
  await Promise.all([connected(viewerA), connected(viewerB)]);
  const [host, p1, p2, p3, p4, p5] = await Promise.all(
    ['host', 'p1', 'p2', 'p3', 'p4', 'p5'].map((name) => {
      createdEmails.push(emailFor(name));
      // A top rating has no participation limit, so these players can join as
      // often as the tests need.
      return User.create({ name, email: emailFor(name), socialRating: 5 });
    })
  );
  const hostId = idOf(host);

  // ---- every viewer hears about membership changes ----------------------
  const sid = (await ok(CREATE, { input: validInput() }, host)).createSession.id;
  await Promise.all([a.next(sid, 'created'), b.next(sid, 'created')]);
  console.log('✓ Creating a session is announced to every connected client');

  await ok(JOIN, { s: sid }, p1);
  await Promise.all([a.next(sid, 'joined'), b.next(sid, 'joined')]);
  assert.equal((await ok(GET, { id: sid })).getSession.participants.length, 2, 'a refetch after the event sees the new player');
  console.log('✓ Joining is announced and a refetch shows the new count');

  await ok(JOIN, { s: sid }, p2);
  await a.next(sid, 'joined');
  const before = a.events.length;
  await fails(JOIN, { s: sid }, p3, 'Session is full');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(a.events.length, before, 'a rejected join changes nothing, so nothing is announced');
  console.log('✓ A newly full session rejects joins from a stale screen');

  const countLeft = a.events.filter((event) => event.reason === 'left').length;
  await fails(LEAVE, { s: sid }, p3, 'not in this session');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(a.events.filter((event) => event.reason === 'left').length, countLeft, 'a rejected leave changes nothing, so nothing is announced');
  await ok(LEAVE, { s: sid }, p2);
  await Promise.all([a.next(sid, 'left'), b.next(sid, 'left')]);
  assert.equal((await ok(GET, { id: sid })).getSession.participants.length, 2);
  console.log('✓ Leaving is announced and frees the spot');

  // ---- concurrent joins for the last spot -------------------------------
  const results = await Promise.all([p2, p3, p4, p5].map((user) => run(JOIN, { s: sid }, user)));
  const winners = results.filter((result) => !result.errors);
  assert.equal(winners.length, 1, 'exactly one of four simultaneous joins gets the last spot');
  assert.ok(results.filter((result) => result.errors).every((result) => result.errors[0].message.includes('Session is full')));
  const roster = (await Session.findById(sid)).participants.map(String);
  assert.equal(roster.length, 3, 'the roster never goes over capacity');
  assert.equal(new Set(roster).size, 3, 'no one is in the roster twice');
  console.log('✓ Simultaneous joins never overfill a session');

  // A join and a leave landing together both stick.
  const winnerId = winners[0].data.joinSession.participants.map((p) => p.id).find((id) => ![hostId, idOf(p1)].includes(id));
  const loser = [p2, p3, p4, p5].find((user) => idOf(user) !== winnerId);
  await Promise.all([run(LEAVE, { s: sid }, p1), run(JOIN, { s: sid }, loser)]);
  const after = (await Session.findById(sid)).participants.map(String);
  assert.ok(!after.includes(idOf(p1)), 'the leave was applied');
  assert.ok(after.length <= 3, 'still within capacity');
  assert.ok(after.includes(hostId) && after.includes(winnerId), 'nobody else was dropped');
  console.log('✓ Concurrent join and leave do not overwrite each other');

  // ---- reconnecting ------------------------------------------------------
  viewerA.disconnect();
  const missed = (await ok(CREATE, { input: validInput() }, host)).createSession.id;
  await b.next(missed, 'created');
  assert.ok(!a.events.some((event) => event.sessionId === missed), 'a disconnected client misses events');
  const reconnected = new Promise((resolve) => viewerA.once('connect', resolve));
  viewerA.connect();
  await reconnected;
  // The app refetches everything on reconnect, so it sees the missed session.
  assert.equal((await ok(GET, { id: missed })).getSession.id, missed);
  await ok(JOIN, { s: missed }, p4);
  await a.next(missed, 'joined');
  console.log('✓ A reconnected client receives updates again');

  // ---- sessions starting and ending by the clock -------------------------
  const t0 = new Date();
  await Session.updateOne({ _id: missed }, { startsAt: new Date(t0 - 5000), endsAt: new Date(+t0 + 500) });
  await checkSessionClock(t0);
  await Promise.all([a.next(missed, 'started'), b.next(missed, 'started')]);
  await checkSessionClock(new Date(+t0 + 1000));
  await Promise.all([a.next(missed, 'ended'), b.next(missed, 'ended')]);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, +t0 + 600 - Date.now())));
  assert.equal((await ok(GET, { id: missed })).getSession.status, 'completed');
  await fails(JOIN, { s: missed }, p5, 'Only upcoming sessions');
  console.log('✓ Sessions starting and ending are announced, and ended ones reject joins');

  console.log('Realtime tests passed');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  viewerA.close();
  viewerB.close();
  await closeRealtime();
  await new Promise((resolve) => httpServer.close(resolve));
  const users = await User.find({ email: { $in: createdEmails } }, '_id');
  const userIds = users.map((user) => user._id);
  await Promise.all([
    Session.deleteMany({ host: { $in: userIds } }),
    SessionRegistration.deleteMany({ user: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  await server.stop();
  await mongoose.disconnect();
}
