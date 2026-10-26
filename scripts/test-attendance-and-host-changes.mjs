// Location check-in (#279), automatic no-show ratings (#280) and host edit /
// cancel (#281).
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { getConfig } from '../backend/src/config.js';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import resolvers, { settleNoShowRatings } from '../backend/src/graphql/resolvers.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import Rating from '../backend/src/models/Rating.js';

const tag = `attendance-test-${Date.now()}`;
const emailFor = (name) => `${tag}-${name}@example.test`;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

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

const CREATE = 'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id}}';
const JOIN = 'mutation($s:ID!,$u:ID!){joinSession(sessionId:$s,userId:$u){id}}';
const CHECK_IN = `mutation($s:ID!,$lat:Float!,$lng:Float!){checkInToSession(sessionId:$s,latitude:$lat,longitude:$lng){
  id myCheckIn }}`;
const REPORT = 'mutation($s:ID!,$n:[ID!]!){reportNoShows(sessionId:$s,noShowUserIds:$n){id}}';
const SUBMIT = 'mutation($s:ID!,$r:ID!,$x:[RatingInput!]!){submitRatings(sessionId:$s,raterId:$r,ratings:$x){success}}';
const GET = `query($id:ID!){getSession(id:$id){
  id status date time startsAt endsAt location locationPoint{coordinates} maxParticipants cancelledAt completedAt
  checkInRequired checkInClosesAt checkInRadiusMeters noShowDeadline myCheckIn
  attendance{user{id} status checkedInAt} ratingEligibility{eligible reason} }}`;
const EDIT = `mutation($s:ID!,$input:EditSessionInput!){editSession(sessionId:$s,input:$input){
  id date time startsAt endsAt location locationPoint{coordinates} maxParticipants status }}`;
const CANCEL = 'mutation($s:ID!){cancelSession(sessionId:$s){id status cancelledAt}}';
const DISCOVER = 'query($status:String){getSessions(status:$status){id}}';
const MINE = 'query{getMySessions{ hosted{id status} joined{id status} completed{id} }}';

const COURT = { longitude: -86.9147, latitude: 40.4259 };
// A point this many meters due north of the court (1 degree of latitude is
// 111,195 m on the sphere the server measures with).
const north = (meters) => ({ lat: COURT.latitude + meters / 111195, lng: COURT.longitude });
const validInput = (overrides = {}) => ({
  sport: 'Pickleball',
  startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
  location: 'Attendance Test Court',
  locationPoint: COURT,
  maxParticipants: 6,
  skillLevel: 2,
  ...overrides
});
const idOf = (user) => String(user._id);
const statusOf = (session, user) => session.attendance.find((entry) => entry.user.id === idOf(user));
// Shifts a stored session so it started `msAgo` ago (negative: starts later)
// and lasts `lengthMs`.
const startSession = (id, msAgo, lengthMs = 2 * HOUR) => Session.updateOne(
  { _id: id },
  { startsAt: new Date(Date.now() - msAgo), endsAt: new Date(Date.now() - msAgo + lengthMs) }
);
const ratingsOf = async (user) => {
  const { ratingSum, totalRatings, socialRating } = await User.findById(user._id).lean();
  return { ratingSum, totalRatings, socialRating };
};

const createdEmails = [];

try {
  await mongoose.connect(getConfig().mongoUri);
  await Session.init();
  const [host, a, b, c, outsider] = await Promise.all(
    ['host', 'a', 'b', 'c', 'outsider'].map((name) => {
      createdEmails.push(emailFor(name));
      return User.create({ name, email: emailFor(name) });
    })
  );
  const hostId = idOf(host);
  const newSession = async (overrides) => (await ok(CREATE, { hostId, input: validInput(overrides) }, host)).createSession.id;

  // ---- #279 location-verified check-in -----------------------------------
  const sid = await newSession();
  for (const user of [a, b, c]) await ok(JOIN, { s: sid, u: idOf(user) });

  const before = (await ok(GET, { id: sid }, a)).getSession;
  assert.equal(before.checkInRequired, true, 'new sessions use check-in');
  assert.equal(before.checkInRadiusMeters, 200);
  assert.equal(new Date(before.checkInClosesAt) - new Date(before.startsAt), 10 * MINUTE);
  await fails(CHECK_IN, { s: sid, ...north(0) }, a, 'opens when the session starts');

  await startSession(sid, -5 * SECOND);
  await fails(CHECK_IN, { s: sid, ...north(0) }, a, 'opens when the session starts');

  await startSession(sid, 5 * SECOND);
  await fails(CHECK_IN, { s: sid, ...north(0) }, null, 'signed in');
  await fails(CHECK_IN, { s: sid, ...north(0) }, outsider, 'Only players in this session');
  await fails(CHECK_IN, { s: sid, ...north(205) }, a, 'within 200 m');
  await fails(CHECK_IN, { s: sid, ...north(1500) }, a, 'about 1500 m away');
  await fails(CHECK_IN, { s: sid, lat: 91, lng: 0 }, a, 'out of range');
  assert.equal((await Session.findById(sid)).checkIns.length, 0, 'rejected check-ins store nothing');

  const checkedIn = (await ok(CHECK_IN, { s: sid, ...north(195) }, a)).checkInToSession;
  assert.ok(checkedIn.myCheckIn, 'a valid check-in is returned');
  await ok(CHECK_IN, { s: sid, ...north(0) }, a);
  await ok(CHECK_IN, { s: sid, ...north(10) }, host);
  const stored = await Session.findById(sid);
  assert.equal(stored.checkIns.length, 2, 'checking in twice keeps one check-in');
  assert.equal(String(stored.checkIns[0].user), idOf(a));

  const during = (await ok(GET, { id: sid }, b)).getSession;
  assert.equal(statusOf(during, a).status, 'SHOWED_UP');
  assert.ok(statusOf(during, a).checkedInAt);
  assert.equal(statusOf(during, b).status, 'PENDING', 'not checked in yet, but the window is open');
  assert.equal(during.myCheckIn, null);

  await startSession(sid, 10 * MINUTE - 5 * SECOND);
  await ok(CHECK_IN, { s: sid, ...north(0) }, b);
  await startSession(sid, 10 * MINUTE + 5 * SECOND);
  await fails(CHECK_IN, { s: sid, ...north(0) }, c, 'Check-in closed');
  console.log('✓ Check-in only works during the first 10 minutes and within 200 m');

  const closed = (await ok(GET, { id: sid }, a)).getSession;
  assert.deepEqual(
    [host, a, b, c].map((user) => statusOf(closed, user).status),
    ['SHOWED_UP', 'SHOWED_UP', 'SHOWED_UP', 'NO_SHOW'],
    'whoever did not check in is absent once the window closes'
  );
  await fails(REPORT, { s: sid, n: [] }, a, 'comes from check-ins');
  console.log('✓ Players who did not check in are marked absent');

  // ---- #280 automatic no-show rating -------------------------------------
  const [hostBefore, aBefore, bBefore] = await Promise.all([host, a, b].map(ratingsOf));
  await settleNoShowRatings();
  assert.deepEqual(await ratingsOf(c), { ratingSum: 1, totalRatings: 1, socialRating: 1 }, 'the no-show gets one rating of 1');
  assert.deepEqual(await Promise.all([host, a, b].map(ratingsOf)), [hostBefore, aBefore, bBefore], 'players who checked in are unaffected');
  assert.equal((await Session.findById(sid)).noShowRatingsSettled, true);

  await settleNoShowRatings();
  await Session.updateOne({ _id: sid }, { noShowRatingsSettled: false });
  await Promise.all([settleNoShowRatings(), settleNoShowRatings()]);
  assert.deepEqual(await ratingsOf(c), { ratingSum: 1, totalRatings: 1, socialRating: 1 }, 'never applied twice');

  await User.updateOne({ _id: c._id }, { ratingSum: 9, totalRatings: 2, socialRating: 4.5 });
  await Session.updateOne({ _id: sid }, { noShowRatingsSettled: false, noShowRated: [] });
  await settleNoShowRatings();
  assert.deepEqual(await ratingsOf(c), { ratingSum: 10, totalRatings: 3, socialRating: 3.3 }, 'the 1 is averaged in');
  console.log('✓ A check-in no-show gets one automatic rating of 1, exactly once');

  await startSession(sid, 3 * HOUR);
  const ended = (await ok(GET, { id: sid }, c)).getSession;
  assert.equal(ended.noShowDeadline, null, 'check-in sessions skip the no-show question');
  assert.match(ended.ratingEligibility.reason, /didn't check in/);
  assert.equal((await ok(GET, { id: sid }, a)).getSession.ratingEligibility.eligible, true, 'checked in, so a can rate straight away');
  await fails(SUBMIT, { s: sid, r: idOf(a), x: [{ userId: idOf(c), rating: 3 }] }, null, 'didn\'t check in');
  await fails(SUBMIT, { s: sid, r: idOf(c), x: [{ userId: idOf(a), rating: 3 }] }, null, 'didn\'t check in');
  for (const [rater, others] of [[host, [a, b]], [a, [host, b]], [b, [host, a]]]) {
    await ok(SUBMIT, { s: sid, r: idOf(rater), x: others.map((user) => ({ userId: idOf(user), rating: 5 })) });
  }
  assert.equal((await Session.findById(sid)).rated, true, 'no-shows do not hold up "everyone rated"');
  console.log('✓ Only players who checked in rate, and only each other');

  const open = await newSession();
  await ok(JOIN, { s: open, u: idOf(a) });
  await startSession(open, 5 * MINUTE);
  const hostBeforeOpen = await ratingsOf(host);
  await settleNoShowRatings();
  assert.deepEqual(await ratingsOf(host), hostBeforeOpen, 'the host has not checked in yet, but check-in is still open');
  assert.equal((await Session.findById(open)).noShowRatingsSettled, false, 'nothing is final while check-in is open');
  assert.deepEqual((await Session.findById(open)).noShowRated, []);

  // Sessions from before check-in keep the peer vote; its result becomes final
  // when the no-show check closes.
  const peer = await newSession();
  await Session.updateOne({ _id: peer }, { checkInRequired: false });
  for (const user of [a, b, c]) await ok(JOIN, { s: peer, u: idOf(user) });
  await startSession(peer, 3 * HOUR);
  await ok(REPORT, { s: peer, n: [idOf(b)] }, host);
  await ok(REPORT, { s: peer, n: [idOf(b)] }, a);
  await ok(REPORT, { s: peer, n: [] }, c);
  assert.equal(statusOf((await ok(GET, { id: peer }, a)).getSession, b).status, 'NO_SHOW');
  const peerBefore = await Promise.all([host, a, b, c].map(ratingsOf));
  await settleNoShowRatings();
  assert.deepEqual(await Promise.all([host, a, b, c].map(ratingsOf)), peerBefore, 'reports can still change before the deadline');
  await startSession(peer, 51 * HOUR);
  await settleNoShowRatings();
  await settleNoShowRatings();
  const peerAfter = await Promise.all([host, a, b, c].map(ratingsOf));
  assert.deepEqual([peerAfter[0], peerAfter[1], peerAfter[3]], [peerBefore[0], peerBefore[1], peerBefore[3]], 'players who showed up are unaffected');
  assert.equal(peerAfter[2].totalRatings, peerBefore[2].totalRatings + 1, 'the majority no-show gets one rating');
  assert.equal(peerAfter[2].ratingSum, peerBefore[2].ratingSum + 1);
  console.log('✓ A peer-majority no-show gets one rating of 1 once the no-show check closes');

  // ---- #281 host edit and cancel -----------------------------------------
  const start = new Date(Date.now() + 24 * HOUR);
  start.setUTCSeconds(0, 0);
  const editable = await newSession({ startsAt: start.toISOString(), maxParticipants: 4 });
  await ok(JOIN, { s: editable, u: idOf(a) });
  await ok(JOIN, { s: editable, u: idOf(b) });

  await fails(EDIT, { s: editable, input: { maxParticipants: 5 } }, null, 'signed in');
  await fails(EDIT, { s: editable, input: { maxParticipants: 5 } }, a, 'Only the host');
  await fails(EDIT, { s: editable, input: { maxParticipants: 1 } }, host, 'from 2 to 50');
  await fails(EDIT, { s: editable, input: { maxParticipants: 2 } }, host, '3 players have already joined');
  await fails(EDIT, { s: editable, input: { startsAt: new Date(Date.now() - HOUR).toISOString() } }, host, 'in the future');
  await fails(EDIT, { s: editable, input: { endsAt: new Date(+start - HOUR).toISOString() } }, host, 'end time must be after');
  await fails(EDIT, { s: editable, input: { endsAt: new Date(+start + 25 * HOUR).toISOString() } }, host, 'at most 24 hours');
  await fails(EDIT, { s: editable, input: { location: 'Somewhere else' } }, host, 'together');
  await fails(EDIT, { s: editable, input: { locationPoint: COURT } }, host, 'together');
  await fails(EDIT, { s: editable, input: { location: ' ', locationPoint: COURT } }, host, 'Location cannot be empty');
  const untouched = await Session.findById(editable).lean();
  assert.deepEqual([untouched.maxParticipants, +untouched.startsAt, untouched.location], [4, +start, 'Attendance Test Court'], 'rejected edits change nothing');

  const moved = new Date(+start + 24 * HOUR);
  const timeEdit = (await ok(EDIT, { s: editable, input: { startsAt: moved.toISOString() } }, host)).editSession;
  assert.equal(timeEdit.startsAt, moved.toISOString());
  assert.equal(new Date(timeEdit.endsAt) - moved, 2 * HOUR, 'moving the start keeps the length');
  assert.deepEqual([timeEdit.date, timeEdit.time], [moved.toISOString().slice(0, 10), moved.toISOString().slice(11, 16)]);
  const endEdit = (await ok(EDIT, { s: editable, input: { endsAt: new Date(+moved + 90 * MINUTE).toISOString() } }, host)).editSession;
  assert.equal(new Date(endEdit.endsAt) - moved, 90 * MINUTE);
  const placeEdit = (await ok(EDIT, {
    s: editable,
    input: { location: ' New Court ', locationPoint: { longitude: -86.92, latitude: 40.43 }, maxParticipants: 3 }
  }, host)).editSession;
  assert.equal(placeEdit.location, 'New Court');
  assert.deepEqual(placeEdit.locationPoint.coordinates, [-86.92, 40.43]);
  assert.equal(placeEdit.maxParticipants, 3, 'capacity can drop to exactly the current player count');
  const seenByPlayer = (await ok(GET, { id: editable }, a)).getSession;
  assert.deepEqual(
    [seenByPlayer.location, seenByPlayer.startsAt, seenByPlayer.maxParticipants],
    ['New Court', moved.toISOString(), 3],
    'joined players see the edits'
  );
  await fails(JOIN, { s: editable, u: idOf(c) }, null, 'Session is full');
  console.log('✓ Hosts can edit time, location and capacity (never below the player count)');

  await fails(CANCEL, { s: editable }, a, 'Only the host');
  await fails(CANCEL, { s: editable }, null, 'signed in');
  assert.ok((await ok(DISCOVER, { status: 'upcoming' }, outsider)).getSessions.some((s) => s.id === editable));
  const cancelled = (await ok(CANCEL, { s: editable }, host)).cancelSession;
  assert.equal(cancelled.status, 'cancelled');
  assert.ok(cancelled.cancelledAt);
  assert.equal((await Session.findById(editable)).status, 'cancelled', 'cancelled is stored');
  for (const status of ['upcoming', 'cancelled', null]) {
    const listed = (await ok(DISCOVER, { status }, outsider)).getSessions;
    assert.ok(!listed.some((s) => s.id === editable), `cancelled sessions are not discoverable (status ${status})`);
  }
  await Session.updateOne({ _id: editable }, { $pull: { participants: b._id } });
  await fails(JOIN, { s: editable, u: idOf(c) }, null, 'was cancelled');
  await fails(EDIT, { s: editable, input: { maxParticipants: 6 } }, host, 'was cancelled');
  await fails(CANCEL, { s: editable }, host, 'was cancelled');
  const aMine = (await ok(MINE, {}, a)).getMySessions;
  assert.deepEqual(aMine.joined.find((s) => s.id === editable), { id: editable, status: 'cancelled' }, 'players still see it, marked cancelled');

  await startSession(editable, 5 * MINUTE);
  await fails(CHECK_IN, { s: editable, ...north(0) }, a, 'was cancelled');
  await startSession(editable, 60 * HOUR);
  const cancelledView = (await ok(GET, { id: editable }, a)).getSession;
  assert.equal(cancelledView.status, 'cancelled');
  assert.equal(cancelledView.completedAt, null);
  assert.match(cancelledView.ratingEligibility.reason, /cancelled/);
  const laterMine = (await ok(MINE, {}, a)).getMySessions;
  assert.ok(![...laterMine.joined, ...laterMine.completed].some((s) => s.id === editable), 'a cancelled session never shows as ended');
  const aBeforeSettle = await ratingsOf(a);
  await settleNoShowRatings();
  assert.deepEqual(await ratingsOf(a), aBeforeSettle, 'cancelled sessions give no no-show ratings');
  console.log('✓ Cancelled sessions leave discovery and cannot be joined, edited or rated');

  const started = await newSession();
  await startSession(started, MINUTE);
  await fails(EDIT, { s: started, input: { maxParticipants: 8 } }, host, 'before they start');
  await fails(CANCEL, { s: started }, host, 'before they start');
  console.log('✓ Sessions cannot be edited or cancelled once they start');

  console.log('Attendance and host change tests passed');
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
