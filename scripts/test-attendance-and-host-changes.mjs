// Check-in removal (#358), sessions that don't go ahead (#360, #375, #376),
// the 5-minute change freeze (#361), automatic no-show ratings (#280) and host
// edit / cancel (#281).
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '../backend/test/support/apollo.js';
import { getConfig } from '../backend/src/config.js';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import resolvers, { notifyInvalidSessions, settleNoShowRatings } from '../backend/src/graphql/resolvers.js';
import User from '../backend/src/models/User.js';
import Notification from '../backend/src/models/Notification.js';
import Session from '../backend/src/models/Session.js';
import Rating from '../backend/src/models/Rating.js';

const tag = `attendance-test-${Date.now()}`;
const emailFor = (name) => `${tag}-${name}@example.test`;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
// The change lock (#361) and the roster check / join cutoff (#376).
const WINDOW = 5 * MINUTE;

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
const JOIN = 'mutation($s:ID!){joinSession(sessionId:$s){id}}';
const LEAVE = 'mutation($s:ID!){leaveSession(sessionId:$s){id}}';
const CHECK_IN = `mutation($s:ID!,$lat:Float!,$lng:Float!){checkInToSession(sessionId:$s,latitude:$lat,longitude:$lng){
  id myCheckIn }}`;
const REPORT = 'mutation($s:ID!,$n:[ID!]!){reportNoShows(sessionId:$s,noShowUserIds:$n){id}}';
const SUBMIT = 'mutation($s:ID!,$x:[RatingInput!]!){submitRatings(sessionId:$s,ratings:$x){success}}';
const GET = `query($id:ID!){getSession(id:$id){
  id status date time startsAt endsAt location locationPoint{coordinates} maxParticipants cancelledAt completedAt
  checkInRequired checkInClosesAt checkInRadiusMeters noShowDeadline myCheckIn
  fullOnly joinClosesAt changesFreezeAt invalidReason
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
      // A top rating (from at least one rating, so they aren't new players)
      // has no participation limit, so the many creates and joins here aren't
      // capped. The resolvers read it from these signed-in objects, so ratings
      // applied in the database below don't change it.
      return User.create({ name, email: emailFor(name), socialRating: 5, totalRatings: 1, ratingSum: 5 });
    })
  );
  const newSession = async (overrides) => (await ok(CREATE, { input: validInput(overrides) }, host)).createSession.id;

  // ---- #358 check-in removed ---------------------------------------------
  const sid = await newSession();
  for (const user of [a, b, c]) await ok(JOIN, { s: sid }, user);
  const before = (await ok(GET, { id: sid }, a)).getSession;
  assert.equal(before.checkInRequired, false, 'new sessions do not use check-in');
  assert.equal(before.checkInClosesAt, null);
  assert.equal(before.myCheckIn, null);
  assert.equal((await Session.findById(sid)).checkInRequired, false, 'stored without check-in');
  await startSession(sid, 5 * SECOND);
  await fails(CHECK_IN, { s: sid, ...north(0) }, a, 'no longer needed');
  assert.equal((await Session.findById(sid)).checkIns.length, 0, 'nothing is stored');

  await startSession(sid, 15 * MINUTE);
  const during = (await ok(GET, { id: sid }, b)).getSession;
  assert.deepEqual(
    [host, a, b, c].map((user) => statusOf(during, user).status),
    ['SHOWED_UP', 'SHOWED_UP', 'SHOWED_UP', 'SHOWED_UP'],
    'nobody is a no-show for not checking in'
  );
  const ratingsBefore = await Promise.all([host, a, b, c].map(ratingsOf));
  await settleNoShowRatings();
  assert.deepEqual(await Promise.all([host, a, b, c].map(ratingsOf)), ratingsBefore, 'no automatic rating for skipping check-in');

  await startSession(sid, 3 * HOUR);
  const ended = (await ok(GET, { id: sid }, a)).getSession;
  assert.ok(ended.noShowDeadline, 'attendance comes from the no-show question');
  assert.match(ended.ratingEligibility.reason, /who didn't show up/);
  console.log('✓ Check-in is gone: attendance comes from no-show reports');

  // ---- #360 a session with only the host doesn't go ahead -----------------
  const solo = await newSession();
  await startSession(solo, -(WINDOW + MINUTE));
  const soloEarly = (await ok(GET, { id: solo }, host)).getSession;
  assert.equal(soloEarly.status, 'upcoming', 'open to players until the roster check 5 minutes before');
  assert.equal(new Date(soloEarly.startsAt) - new Date(soloEarly.joinClosesAt), WINDOW, 'a host on their own has until 5 minutes before');
  await startSession(solo, -(WINDOW - MINUTE));
  const soloChecked = (await ok(GET, { id: solo }, host)).getSession;
  assert.equal(soloChecked.status, 'invalid', 'still only the host 5 minutes before, so it is not happening');
  await fails(JOIN, { s: solo }, c, 'Nobody else joined');
  await startSession(solo, MINUTE);
  const soloStarted = (await ok(GET, { id: solo }, host)).getSession;
  assert.equal(soloStarted.status, 'invalid');
  assert.match(soloStarted.invalidReason, /Nobody else joined/);
  const hostMine = (await ok(MINE, {}, host)).getMySessions;
  assert.deepEqual(
    hostMine.hosted.find((s) => s.id === solo),
    { id: solo, status: 'invalid' },
    'still listed, marked as not happening, until its planned end'
  );
  assert.ok(!hostMine.completed.some((s) => s.id === solo));

  await notifyInvalidSessions(new Date(), { sessionIds: [solo] });
  await notifyInvalidSessions(new Date(), { sessionIds: [solo] });
  const soloNotices = await Notification.find({ recipient: host._id, type: 'session_invalid' });
  assert.equal(soloNotices.length, 1, 'the host is told once');
  assert.equal(soloNotices[0].target.params.sessionId, solo);

  await startSession(solo, 3 * HOUR);
  const soloEnded = (await ok(GET, { id: solo }, host)).getSession;
  assert.equal(soloEnded.status, 'cancelled', 'once its end passes it reads as cancelled, never completed');
  assert.match(soloEnded.invalidReason, /Nobody else joined/, 'and still says why');
  assert.equal(soloEnded.cancelledAt, null, 'nobody cancelled it by hand');
  assert.equal(soloEnded.completedAt, null);
  assert.equal(soloEnded.noShowDeadline, null);
  assert.equal(soloEnded.ratingEligibility.eligible, false);
  assert.match(soloEnded.ratingEligibility.reason, /nothing to rate/);
  await fails(REPORT, { s: solo, n: [] }, host, 'nothing to report');
  await fails(SUBMIT, { s: solo, x: [] }, host, 'nothing to rate');
  const hostMineLater = (await ok(MINE, {}, host)).getMySessions;
  assert.ok(
    ![...hostMineLater.hosted, ...hostMineLater.joined, ...hostMineLater.completed].some((s) => s.id === solo),
    'after its planned end it leaves My Sessions, like a cancelled one'
  );
  const hostBeforeSolo = await ratingsOf(host);
  await startSession(solo, 51 * HOUR);
  await settleNoShowRatings();
  assert.deepEqual(await ratingsOf(host), hostBeforeSolo, 'no ratings from a session that did not go ahead');
  assert.equal((await Session.findById(solo)).noShowRatingsSettled, true, 'and it is settled as it is');
  console.log('✓ A session with only the host is not happening, then cancelled: announced, never rated');

  // ---- #375 / #376 only show up if full -----------------------------------
  const fullOnly = await newSession({ maxParticipants: 4, fullOnly: true });
  const fo = (await ok(GET, { id: fullOnly }, a)).getSession;
  assert.equal(fo.fullOnly, true);
  assert.equal(new Date(fo.startsAt) - new Date(fo.joinClosesAt), WINDOW, 'joining closes 5 minutes before');
  await ok(JOIN, { s: fullOnly }, a);
  await startSession(fullOnly, -(WINDOW + MINUTE));
  await ok(JOIN, { s: fullOnly }, b);
  assert.equal((await ok(GET, { id: fullOnly }, a)).getSession.status, 'upcoming', 'still upcoming while joining is open');
  await startSession(fullOnly, -(WINDOW - MINUTE));
  await fails(JOIN, { s: fullOnly }, c, 'didn\'t fill up');
  const off = (await ok(GET, { id: fullOnly }, a)).getSession;
  assert.equal(off.status, 'invalid', 'not full when joining closed, so it is off before it starts');
  assert.match(off.invalidReason, /didn't fill up/);
  await notifyInvalidSessions(new Date(), { sessionIds: [fullOnly] });
  for (const user of [host, a, b]) {
    const notices = await Notification.countDocuments({ recipient: user._id, type: 'session_invalid', 'target.params.sessionId': fullOnly });
    assert.equal(notices, 1, 'every player is told');
  }
  await startSession(fullOnly, 3 * HOUR);
  const foEnded = (await ok(GET, { id: fullOnly }, a)).getSession;
  assert.equal(foEnded.noShowDeadline, null, 'nobody is asked about no-shows');
  assert.equal(foEnded.status, 'cancelled', 'past full-only sessions that never filled read as cancelled');

  const filled = await newSession({ maxParticipants: 3, fullOnly: true });
  await ok(JOIN, { s: filled }, a);
  await ok(JOIN, { s: filled }, b);
  await startSession(filled, -(WINDOW - MINUTE));
  assert.equal((await ok(GET, { id: filled }, a)).getSession.status, 'upcoming', 'a full full-only session goes ahead');
  await startSession(filled, 3 * HOUR);
  const filledEnded = (await ok(GET, { id: filled }, a)).getSession;
  assert.equal(filledEnded.status, 'completed');
  assert.ok(filledEnded.noShowDeadline);

  console.log('✓ Full-only sessions close to joins 5 minutes early and are off unless full');

  // A regular session with 2+ players keeps taking players until it starts.
  const regular = await newSession();
  await ok(JOIN, { s: regular }, a);
  await startSession(regular, -(WINDOW - MINUTE));
  const regularLate = (await ok(GET, { id: regular }, b)).getSession;
  assert.equal(regularLate.status, 'upcoming');
  assert.equal(regularLate.joinClosesAt, regularLate.startsAt, 'with 2 players, joining stays open until the start');
  assert.ok((await ok(DISCOVER, { status: 'upcoming' }, outsider)).getSessions.some((s) => s.id === regular), 'and it stays in Explore');
  await ok(JOIN, { s: regular }, b);
  await startSession(regular, MINUTE);
  await fails(JOIN, { s: regular }, c, 'Only upcoming sessions');
  console.log('✓ Regular sessions with 2+ players take joins until they start');

  // ---- #361 sessions freeze 5 minutes before they start ------------------
  const soon = await newSession();
  await ok(JOIN, { s: soon }, a);
  await startSession(soon, -(WINDOW + MINUTE));
  const notYet = (await ok(GET, { id: soon }, a)).getSession;
  assert.equal(new Date(notYet.startsAt) - new Date(notYet.changesFreezeAt), WINDOW);
  await ok(EDIT, { s: soon, input: { maxParticipants: 7 } }, host);
  await fails(EDIT, { s: soon, input: { startsAt: new Date(Date.now() + 3 * MINUTE).toISOString() } }, host, 'at least 5 minutes from now');
  await startSession(soon, -(WINDOW - MINUTE));
  await fails(EDIT, { s: soon, input: { maxParticipants: 8 } }, host, 'in the 5 minutes before');
  await fails(CANCEL, { s: soon }, host, 'in the 5 minutes before');
  await fails(LEAVE, { s: soon }, a, 'in the 5 minutes before');
  const frozenSession = await Session.findById(soon);
  assert.equal(frozenSession.status, 'upcoming', 'rejected changes store nothing');
  assert.ok(frozenSession.participants.some((id) => id.equals(a._id)), 'a is still in');
  await ok(JOIN, { s: soon }, b);
  console.log('✓ Sessions can\'t be edited, cancelled or left in the 5 minutes before they start');

  // Sessions from before check-in keep the peer vote; its result becomes final
  // when the no-show check closes.
  const peer = await newSession();
  await Session.updateOne({ _id: peer }, { checkInRequired: false });
  for (const user of [a, b, c]) await ok(JOIN, { s: peer }, user);
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
  await ok(JOIN, { s: editable }, a);
  await ok(JOIN, { s: editable }, b);

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
  await fails(JOIN, { s: editable }, c, 'Session is full');
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
  await fails(JOIN, { s: editable }, c, 'was cancelled');
  await fails(EDIT, { s: editable, input: { maxParticipants: 6 } }, host, 'was cancelled');
  await fails(CANCEL, { s: editable }, host, 'was cancelled');
  const aMine = (await ok(MINE, {}, a)).getMySessions;
  assert.deepEqual(aMine.joined.find((s) => s.id === editable), { id: editable, status: 'cancelled' }, 'players still see it, marked cancelled');

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
    Notification.deleteMany({ recipient: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  await server.stop();
  await mongoose.disconnect();
}
