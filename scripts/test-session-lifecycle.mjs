// Session creation (FR-1 inputs and end times), automatic ending, no-show
// reports and rating eligibility.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { getConfig } from '../backend/src/config.js';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import resolvers from '../backend/src/graphql/resolvers.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import Rating from '../backend/src/models/Rating.js';

const tag = `lifecycle-test-${Date.now()}`;
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

const CREATE = `mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){
  id sport location startsAt endsAt skillLevel skillRange maxParticipants status participants{id} }}`;
const JOIN = 'mutation($s:ID!,$u:ID!){joinSession(sessionId:$s,userId:$u){id}}';
const LEAVE = 'mutation($s:ID!,$u:ID!){leaveSession(sessionId:$s,userId:$u){id}}';
const REPORT = `mutation($s:ID!,$n:[ID!]!){reportNoShows(sessionId:$s,noShowUserIds:$n){
  id myNoShowReport{noShows} ratingEligibility{eligible reason} }}`;
const GET = `query($id:ID!){getSession(id:$id){
  id status endsAt completedAt noShowDeadline rated
  attendance{user{id} status noShowReports} myNoShowReport{noShows reportedAt}
  ratingEligibility{eligible reason} }}`;
const SUBMIT = 'mutation($s:ID!,$r:ID!,$x:[RatingInput!]!){submitRatings(sessionId:$s,raterId:$r,ratings:$x){success}}';
const MINE = `query{getMySessions{
  hosted{id} joined{id} completed{id ratingEligibility{eligible}} }}`;

const inFuture = (hours = 24) => new Date(Date.now() + hours * HOUR).toISOString();
const validInput = (overrides = {}) => ({
  sport: 'Pickleball',
  startsAt: inFuture(),
  location: 'Lifecycle Test Court',
  locationPoint: { longitude: -86.9147, latitude: 40.4259 },
  maxParticipants: 4,
  skillLevel: 2,
  ...overrides
});
const statusOf = (session, user) => session.attendance.find((entry) => entry.user.id === String(user._id));
const idOf = (user) => String(user._id);
// Shifts a stored session so it started `startedHoursAgo` and ends `endsInHours` from now.
const moveSession = (id, startedHoursAgo, endsInHours) => Session.updateOne(
  { _id: id },
  { startsAt: new Date(Date.now() - startedHoursAgo * HOUR), endsAt: new Date(Date.now() + endsInHours * HOUR) }
);

const createdEmails = [];

try {
  await mongoose.connect(getConfig().mongoUri);
  const [host, a, b, c, outsider] = await Promise.all(
    ['host', 'a', 'b', 'c', 'outsider'].map((name) => {
      createdEmails.push(emailFor(name));
      return User.create({ name, email: emailFor(name) });
    })
  );
  const hostId = idOf(host);

  // ---- #206 creation inputs, plus end times ------------------------------
  await fails(CREATE, { hostId, input: validInput({ skillLevel: null }) }, host, 'Choose a skill level');
  await fails(CREATE, { hostId, input: validInput({ maxParticipants: null }) }, host, 'Choose how many players');
  await fails(CREATE, { hostId, input: validInput({ skillLevel: 0 }) }, host, 'Skill level must be 1');
  await fails(CREATE, { hostId, input: validInput({ skillLevel: 4 }) }, host, 'Skill level must be 1');
  await fails(CREATE, { hostId, input: validInput({ maxParticipants: 1 }) }, host, 'from 2 to 50');
  await fails(CREATE, { hostId, input: validInput({ maxParticipants: 51 }) }, host, 'from 2 to 50');
  await fails(CREATE, { hostId, input: validInput({ sport: '   ' }) }, host, 'Sport cannot be empty');
  await fails(CREATE, { hostId, input: validInput({ location: '' }) }, host, 'Location cannot be empty');
  await fails(CREATE, { hostId, input: validInput({ startsAt: new Date(Date.now() - HOUR).toISOString() }) }, host, 'in the future');
  await fails(CREATE, { hostId, input: validInput({ startsAt: 'not-a-date' }) }, host, 'valid ISO date');
  const start = new Date(Date.now() + 24 * HOUR);
  start.setUTCSeconds(0, 0);
  await fails(CREATE, { hostId, input: validInput({ startsAt: start.toISOString(), endsAt: start.toISOString() }) }, host, 'end time must be after');
  await fails(CREATE, { hostId, input: validInput({ startsAt: start.toISOString(), endsAt: new Date(start - HOUR).toISOString() }) }, host, 'end time must be after');
  await fails(CREATE, { hostId, input: validInput({ startsAt: start.toISOString(), endsAt: new Date(+start + 25 * HOUR).toISOString() }) }, host, 'at most 24 hours');
  await fails(CREATE, { hostId, input: validInput({ endsAt: 'soon' }) }, host, 'endsAt must be a valid ISO date');
  assert.equal(await Session.countDocuments({ host: host._id }), 0, 'invalid requests create nothing');
  console.log('✓ Invalid session inputs and end times are rejected without creating a session');

  const defaulted = (await ok(CREATE, { hostId, input: validInput({ startsAt: start.toISOString() }) }, host)).createSession;
  assert.equal(new Date(defaulted.endsAt) - new Date(defaulted.startsAt), 2 * HOUR, 'end defaults to 2 hours after start');
  assert.equal((await Session.findById(defaulted.id)).endsAt.getTime(), +start + 2 * HOUR, 'default end is stored');
  await Session.deleteOne({ _id: defaulted.id });

  const created = (await ok(CREATE, {
    hostId,
    input: validInput({ sport: ' Pickleball ', skillLevel: 3, maxParticipants: 4, startsAt: start.toISOString(), endsAt: new Date(+start + 90 * 60000).toISOString() })
  }, host)).createSession;
  assert.equal(created.sport, 'Pickleball', 'sport is trimmed');
  assert.equal(created.skillLevel, 3);
  assert.equal(created.skillRange, '4.0-5.0', 'skill level maps onto the discovery scale');
  assert.equal(created.maxParticipants, 4);
  assert.equal(created.status, 'upcoming');
  assert.equal(new Date(created.endsAt) - new Date(created.startsAt), 90 * 60000, 'a chosen end time is kept');
  const stored = await Session.findById(created.id);
  assert.deepEqual([stored.skillLevel, stored.skillMin, stored.skillMax, stored.maxParticipants], [3, 4, 5, 4]);
  console.log('✓ Valid session stores capacity, skill level and end time in MongoDB');

  const discovered = (await ok(
    'query($f:SessionDiscoveryFilterInput){getSessions(status:"upcoming",filter:$f){id skillLevel maxParticipants endsAt}}',
    { f: { minSkillLevel: 4, maxSkillLevel: 5 } },
    outsider
  )).getSessions.find((session) => session.id === created.id);
  assert.deepEqual(discovered, { id: created.id, skillLevel: 3, maxParticipants: 4, endsAt: created.endsAt }, 'another user sees the same values');
  const beginnerOnly = (await ok(
    'query($f:SessionDiscoveryFilterInput){getSessions(status:"upcoming",filter:$f){id}}',
    { f: { minSkillLevel: 1, maxSkillLevel: 1 } },
    outsider
  )).getSessions;
  assert.ok(!beginnerOnly.some((session) => session.id === created.id), 'advanced sessions are filtered out for beginners');
  console.log('✓ Capacity, skill level and end time are visible through discovery');

  // ---- #204 automatic ending ---------------------------------------------
  const sid = created.id;
  for (const user of [a, b, c]) await ok(JOIN, { s: sid, u: idOf(user) });
  await fails(JOIN, { s: sid, u: idOf(outsider) }, null, 'Session is full');

  await fails(SUBMIT, { s: sid, r: idOf(a), x: [{ userId: hostId, rating: 5 }] }, null, 'completed sessions');
  await fails(REPORT, { s: sid, n: [] }, a, 'once the session has ended');

  await moveSession(sid, 1, 1);
  const live = (await ok(GET, { id: sid }, a)).getSession;
  assert.equal(live.status, 'in_progress', 'started but not over');
  assert.equal(live.completedAt, null);
  assert.equal(live.ratingEligibility.eligible, false);
  await fails(REPORT, { s: sid, n: [] }, a, 'once the session has ended');
  assert.deepEqual((await ok(MINE, {}, host)).getMySessions.hosted.map((s) => s.id), [sid], 'in-progress sessions are still open');

  await moveSession(sid, 3, -1);
  const ended = (await ok(GET, { id: sid }, a)).getSession;
  assert.equal(ended.status, 'completed', 'ends on its own once endsAt passes');
  assert.equal(ended.completedAt, ended.endsAt);
  assert.equal(new Date(ended.noShowDeadline) - new Date(ended.endsAt), 48 * HOUR);
  assert.equal((await Session.findById(sid)).status, 'upcoming', 'nothing had to be written to end it');
  await fails(JOIN, { s: sid, u: idOf(outsider) }, null, 'Only upcoming sessions');
  await fails(LEAVE, { s: sid, u: idOf(a) }, null, 'has ended');
  assert.match(ended.ratingEligibility.reason, /who didn't show up/);
  await fails(SUBMIT, { s: sid, r: idOf(a), x: [{ userId: hostId, rating: 5 }] }, null, 'who didn\'t show up');
  console.log('✓ Sessions end automatically at their end time');

  // ---- #204 no-show reports ----------------------------------------------
  await fails(REPORT, { s: sid, n: [] }, null, 'signed in');
  await fails(REPORT, { s: sid, n: [] }, outsider, 'Only players in this session');
  await fails(REPORT, { s: sid, n: [idOf(a)] }, a, 'cannot report yourself');
  await fails(REPORT, { s: sid, n: [idOf(outsider)] }, a, 'only report players who joined');

  await ok(REPORT, { s: sid, n: [idOf(c)] }, host);
  const aReport = (await ok(REPORT, { s: sid, n: [idOf(c), idOf(c)] }, a)).reportNoShows;
  assert.deepEqual(aReport.myNoShowReport.noShows, [idOf(c)], 'duplicates are collapsed');
  assert.equal(aReport.ratingEligibility.eligible, true, 'answering the check unlocks rating');
  await ok(REPORT, { s: sid, n: [] }, b);
  await ok(REPORT, { s: sid, n: [idOf(a)] }, c);

  const tally = (await ok(GET, { id: sid }, c)).getSession;
  assert.deepEqual(
    { status: statusOf(tally, c).status, reports: statusOf(tally, c).noShowReports },
    { status: 'NO_SHOW', reports: 2 },
    '2 of the 3 other answers flagged c'
  );
  assert.deepEqual(
    { status: statusOf(tally, a).status, reports: statusOf(tally, a).noShowReports },
    { status: 'SHOWED_UP', reports: 1 },
    'one report out of three is not a majority'
  );
  assert.match(tally.ratingEligibility.reason, /reported that you didn't show up/);
  await fails(SUBMIT, { s: sid, r: idOf(c), x: [{ userId: hostId, rating: 1 }] }, null, 'didn\'t show up');
  assert.equal((await Session.findById(sid)).noShowReports.length, 4, 'one stored answer per player');

  const bChanged = (await ok(REPORT, { s: sid, n: [idOf(c)] }, b)).reportNoShows;
  assert.deepEqual(bChanged.myNoShowReport.noShows, [idOf(c)], 'answers can be changed before rating');
  assert.equal((await Session.findById(sid)).noShowReports.length, 4, 'changing an answer replaces it');
  console.log('✓ Players report no-shows and the majority decides');

  await fails(SUBMIT, { s: sid, r: idOf(a), x: [{ userId: idOf(c), rating: 1 }] }, null, 'reported as a no-show');
  await ok(SUBMIT, { s: sid, r: idOf(a), x: [{ userId: hostId, rating: 5 }, { userId: idOf(b), rating: 4 }] });
  await fails(REPORT, { s: sid, n: [] }, a, 'can no longer change');
  assert.match((await ok(GET, { id: sid }, a)).getSession.ratingEligibility.reason, /already rated/);
  await ok(SUBMIT, { s: sid, r: hostId, x: [{ userId: idOf(a), rating: 4 }, { userId: idOf(b), rating: 4 }] });
  assert.equal((await Session.findById(sid)).rated, false, 'b has not rated yet');
  await ok(SUBMIT, { s: sid, r: idOf(b), x: [{ userId: hostId, rating: 4 }, { userId: idOf(a), rating: 5 }] });
  assert.equal((await Session.findById(sid)).rated, true, 'rated once everyone who showed up has rated');
  console.log('✓ Rating skips no-shows and players you reported');

  // ---- No-show window and older sessions ----------------------------------
  const late = (await ok(CREATE, { hostId, input: validInput() }, host)).createSession;
  await ok(JOIN, { s: late.id, u: idOf(a) });
  await moveSession(late.id, 52, -50);
  const lateView = (await ok(GET, { id: late.id }, a)).getSession;
  assert.ok(new Date(lateView.noShowDeadline) < new Date(), 'deadline has passed');
  assert.match(lateView.ratingEligibility.reason, /no-show check closed/);
  await fails(REPORT, { s: late.id, n: [] }, a, 'has closed');

  const legacy = await Session.create({
    sport: 'Tennis', date: '2026-01-01', time: '10:00', startsAt: new Date('2026-01-01T10:00:00Z'),
    location: 'Lifecycle Test Court', locationPoint: { type: 'Point', coordinates: [-86.9, 40.4] },
    participants: [host._id, a._id], host: host._id, status: 'completed'
  });
  const legacyView = (await ok(GET, { id: String(legacy._id) }, a)).getSession;
  assert.equal(legacyView.ratingEligibility.eligible, true, 'sessions completed before this change keep the old rules');
  assert.equal(legacyView.noShowDeadline, null);
  await fails(REPORT, { s: String(legacy._id), n: [] }, a, 'not collected');
  console.log('✓ The no-show check closes after 48 hours; older sessions are unaffected');

  // ---- #203 My Sessions ---------------------------------------------------
  const upcoming = (await ok(CREATE, { hostId, input: validInput({ skillLevel: 1 }) }, host)).createSession;
  await ok(JOIN, { s: upcoming.id, u: idOf(b) });
  const hostView = (await ok(MINE, {}, host)).getMySessions;
  assert.deepEqual(hostView.hosted.map((s) => s.id), [upcoming.id]);
  assert.deepEqual(hostView.joined, []);
  assert.deepEqual(hostView.completed.map((s) => s.id).sort(), [sid, late.id, String(legacy._id)].sort());
  const bView = (await ok(MINE, {}, b)).getMySessions;
  assert.deepEqual(bView.joined.map((s) => s.id), [upcoming.id]);
  assert.equal(bView.completed.find((s) => s.id === sid).ratingEligibility.eligible, false, 'already rated');
  await ok(LEAVE, { s: upcoming.id, u: idOf(b) });
  assert.deepEqual((await ok(MINE, {}, b)).getMySessions.joined, [], 'leaving removes it from My Sessions');
  assert.deepEqual(await ok(MINE, {}, outsider), { getMySessions: { hosted: [], joined: [], completed: [] } });
  await fails(MINE, {}, null, 'signed in');
  console.log('✓ My Sessions splits hosted, joined and ended sessions');

  console.log('Session lifecycle tests passed');
} catch (error) {
  // The shared winston logger handles uncaught errors without exiting, which
  // would otherwise let a failing run end with exit code 0.
  console.error(error);
  process.exitCode = 1;
} finally {
  const users = await User.find({ email: { $in: createdEmails } }, '_id');
  const userIds = users.map((user) => user._id);
  const sessions = await Session.find({ host: { $in: userIds } }, '_id');
  await Promise.all([
    Rating.deleteMany({ session: { $in: sessions.map((session) => session._id) } }),
    Session.deleteMany({ _id: { $in: sessions.map((session) => session._id) } }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  await server.stop();
  await mongoose.disconnect();
}
