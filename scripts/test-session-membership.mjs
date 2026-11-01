// #194: joining and leaving sessions keeps the stored roster correct.
import assert from 'node:assert/strict';
import Session from '../backend/src/models/Session.js';
import { idOf, moveSession, runTest, sessionInput, startHarness } from './lib/graphqlHarness.mjs';

const harness = await startHarness(`membership-test-${Date.now()}`);
const { ok, fails, createUsers } = harness;

const CREATE = 'mutation($i:CreateSessionInput!){createSession(input:$i){id participants{id}}}';
const JOIN = 'mutation($s:ID!){joinSession(sessionId:$s){id maxParticipants participants{id}}}';
const LEAVE = 'mutation($s:ID!){leaveSession(sessionId:$s){id participants{id}}}';

// The roster exactly as MongoDB has it.
async function storedRoster(sessionId) {
  const session = await Session.findById(sessionId).lean();
  return { participants: session.participants.map(String), version: session.__v };
}

await runTest(harness, async () => {
  const [host, a, b, c, outsider, ...racers] = await createUsers(
    ['host', 'a', 'b', 'c', 'outsider', 'r1', 'r2', 'r3', 'r4', 'r5']
  );
  const sid = (await ok(CREATE, { i: sessionInput({ maxParticipants: 3 }) }, host)).createSession.id;

  // ---- Valid joins and leaves ---------------------------------------------
  let roster = (await ok(JOIN, { s: sid }, a)).joinSession.participants.map((p) => p.id);
  assert.deepEqual(roster, [idOf(host), idOf(a)], 'a joins');
  roster = (await ok(JOIN, { s: sid }, b)).joinSession.participants.map((p) => p.id);
  assert.deepEqual(roster, [idOf(host), idOf(a), idOf(b)], 'b takes the last spot');
  assert.deepEqual((await storedRoster(sid)).participants, roster, 'the stored roster matches');
  console.log('✓ Joining adds the caller to the stored roster');

  // ---- Invalid joins leave the stored session alone ------------------------
  const before = await storedRoster(sid);
  await fails(JOIN, { s: sid }, host, 'You are hosting this session');
  await fails(JOIN, { s: sid }, a, 'already joined');
  await fails(JOIN, { s: sid }, c, 'Session is full');
  await fails(JOIN, { s: sid }, null, 'signed in');
  await fails(JOIN, { s: '000000000000000000000000' }, c, 'Session not found');
  await fails(JOIN, { s: 'not-an-id' }, c, 'Session not found');
  assert.deepEqual(await storedRoster(sid), before, 'rejected joins change nothing, not even the version');
  console.log('✓ Host, duplicate, full and unknown-session joins are rejected without changing anything');

  // ---- Leaving frees a spot ------------------------------------------------
  roster = (await ok(LEAVE, { s: sid }, a)).leaveSession.participants.map((p) => p.id);
  assert.deepEqual(roster, [idOf(host), idOf(b)], 'a leaves');
  roster = (await ok(JOIN, { s: sid }, c)).joinSession.participants.map((p) => p.id);
  assert.deepEqual(roster, [idOf(host), idOf(b), idOf(c)], 'the freed spot can be taken');
  const full = await storedRoster(sid);
  await fails(LEAVE, { s: sid }, host, 'host cannot leave');
  await fails(LEAVE, { s: sid }, outsider, 'not in this session');
  await fails(LEAVE, { s: sid }, a, 'not in this session');
  await fails(LEAVE, { s: sid }, null, 'signed in');
  assert.deepEqual(await storedRoster(sid), full, 'rejected leaves change nothing');
  console.log('✓ Leaving frees a spot; host and non-member leaves are rejected');

  // ---- Concurrent joins can't overfill a session --------------------------
  const race = (await ok(CREATE, { i: sessionInput({ maxParticipants: 3 }) }, host)).createSession.id;
  const results = await Promise.all(racers.map((racer) => harness.run(JOIN, { s: race }, racer)));
  const winners = results.filter((result) => !result.errors);
  assert.equal(winners.length, 2, 'exactly the two open spots are taken');
  assert.ok(results.filter((result) => result.errors).every((result) => result.errors[0].message === 'Session is full'));
  const raced = await storedRoster(race);
  assert.equal(raced.participants.length, 3, 'the stored count never goes over capacity');
  assert.equal(new Set(raced.participants).size, 3, 'nobody is stored twice');
  console.log('✓ Five people racing for two spots fill exactly two');

  const twice = (await ok(CREATE, { i: sessionInput({ maxParticipants: 6 }) }, host)).createSession.id;
  await Promise.all([1, 2, 3].map(() => harness.run(JOIN, { s: twice }, outsider)));
  assert.deepEqual((await storedRoster(twice)).participants, [idOf(host), idOf(outsider)], 'repeated joins add someone once');
  console.log('✓ Repeated joins by the same person add them once');

  // ---- Sessions that are no longer open ------------------------------------
  await moveSession(sid, 1, 1);
  await fails(JOIN, { s: sid }, outsider, 'Only upcoming sessions');
  await fails(LEAVE, { s: sid }, b, 'already started');
  await moveSession(sid, 3, -1);
  await fails(JOIN, { s: sid }, outsider, 'Only upcoming sessions');
  await fails(LEAVE, { s: sid }, b, 'has ended');
  assert.deepEqual((await storedRoster(sid)).participants, full.participants, 'started and ended sessions keep their roster');
  console.log('✓ Sessions can only be joined or left before they start');

  console.log('Session membership tests passed');
});
