// FR-8 social-rating cooldown (#210): when it starts, what it blocks, the
// rating boundary, and what happens when it expires.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { getConfig } from '../backend/src/config.js';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import resolvers from '../backend/src/graphql/resolvers.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import Rating from '../backend/src/models/Rating.js';

const tag = `cooldown-test-${Date.now()}`;
const emailFor = (name) => `${tag}-${name}@example.test`;
const HOUR = 60 * 60 * 1000;
const COOLDOWN_MS = 48 * HOUR;

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

// Expects the cooldown error and returns its end time.
async function blocked(query, variables, currentUser) {
  const result = await run(query, variables, currentUser);
  assert.ok(result.errors, 'expected the request to be blocked by the cooldown');
  const [error] = result.errors;
  assert.equal(error.extensions.code, 'ACCOUNT_COOLDOWN', `expected ACCOUNT_COOLDOWN, got "${error.message}"`);
  assert.ok(error.message.includes('below 2'), 'the message says why');
  return new Date(error.extensions.cooldownUntil);
}

const CREATE = 'mutation($hostId:ID!,$input:CreateSessionInput!){createSession(hostId:$hostId,input:$input){id}}';
const JOIN = 'mutation($s:ID!,$u:ID!){joinSession(sessionId:$s,userId:$u){id}}';
const SUBMIT = 'mutation($s:ID!,$r:ID!,$x:[RatingInput!]!){submitRatings(sessionId:$s,raterId:$r,ratings:$x){success}}';
const ME = 'query($id:ID!){getUser(id:$id){id socialRating cooldownUntil}}';

const idOf = (user) => String(user._id);
const input = () => ({
  sport: 'Pickleball',
  startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
  location: `Cooldown Test Court ${tag}`,
  locationPoint: { longitude: -86.9147, latitude: 40.4259 },
  maxParticipants: 6,
  skillLevel: 2
});

const createdEmails = [];
async function makeUser(name, fields = {}) {
  createdEmails.push(emailFor(name));
  return User.create({ name, email: emailFor(name), ...fields });
}

// Gives `ratee` one rating from `rater` through the real submitRatings flow:
// an ended session they both played, with both no-show answers in.
async function rate(rater, ratee, value) {
  const start = new Date(Date.now() - 3 * HOUR);
  const session = await Session.create({
    sport: 'Pickleball',
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 16),
    startsAt: start,
    endsAt: new Date(Date.now() - HOUR),
    location: `Cooldown Test Court ${tag}`,
    locationPoint: { type: 'Point', coordinates: [-86.9147, 40.4259] },
    maxParticipants: 2,
    host: rater._id,
    participants: [rater._id, ratee._id],
    status: 'upcoming',
    noShowReports: [{ reporter: rater._id, noShows: [] }, { reporter: ratee._id, noShows: [] }]
  });
  await ok(SUBMIT, { s: String(session._id), r: idOf(rater), x: [{ userId: idOf(ratee), rating: value }] });
  return User.findById(ratee._id);
}

const withinSeconds = (actual, expected, seconds = 60) => Math.abs(actual - expected) <= seconds * 1000;

try {
  await mongoose.connect(getConfig().mongoUri);
  const [rater, other, target] = await Promise.all([makeUser('rater'), makeUser('other'), makeUser('target')]);
  const openSession = (await ok(CREATE, { hostId: idOf(other), input: input() }, other)).createSession.id;

  // ---- a low rating starts a 2-day cooldown -----------------------------
  const rated = await rate(rater, target, 1);
  assert.equal(rated.socialRating, 1);
  assert.ok(rated.cooldownUntil, 'a rating below 2 starts a cooldown');
  assert.ok(withinSeconds(rated.cooldownUntil, Date.now() + COOLDOWN_MS), 'the cooldown lasts 2 days');
  console.log('✓ A rating that drops the social rating below 2 starts a 2-day cooldown');

  // ---- create and join are blocked, however they are called -------------
  // `rated` is the user as the server loads them for a signed-in request.
  const until = await blocked(CREATE, { hostId: idOf(target), input: input() }, rated);
  assert.equal(+until, +rated.cooldownUntil, 'the error carries the end time');
  await blocked(JOIN, { s: openSession, u: idOf(target) }, rated);
  // Signed in as the suspended user but naming someone else.
  await blocked(CREATE, { hostId: idOf(other), input: input() }, rated);
  await blocked(JOIN, { s: openSession, u: idOf(other) }, rated);
  // Not signed in at all, naming the suspended user.
  await blocked(CREATE, { hostId: idOf(target), input: input() }, null);
  await blocked(JOIN, { s: openSession, u: idOf(target) }, null);
  assert.equal(await Session.countDocuments({ host: target._id, startsAt: { $gt: new Date() } }), 0, 'nothing was created');
  assert.ok(!(await Session.findById(openSession)).participants.some((id) => id.equals(target._id)), 'nothing was joined');
  console.log('✓ Create and join are rejected during the cooldown, including direct GraphQL calls');

  // ---- only the user sees their own cooldown ----------------------------
  const own = (await ok(ME, { id: idOf(target) }, target)).getUser;
  assert.equal(own.cooldownUntil, rated.cooldownUntil.toISOString());
  assert.equal((await ok(ME, { id: idOf(target) }, other)).getUser.cooldownUntil, null);
  assert.equal((await ok(ME, { id: idOf(target) }, null)).getUser.cooldownUntil, null);
  console.log('✓ The cooldown end time is shown only to the suspended user');

  // ---- more low ratings during a cooldown don't extend it ---------------
  const again = await rate(rater, target, 1);
  assert.equal(+again.cooldownUntil, +rated.cooldownUntil, 'an active cooldown is not extended');
  console.log('✓ Further low ratings during a cooldown do not extend it');

  // ---- expiry -----------------------------------------------------------
  await User.updateOne({ _id: target._id }, { cooldownUntil: new Date(Date.now() - 1000) });
  const expired = await User.findById(target._id);
  assert.equal((await ok(ME, { id: idOf(target) }, expired)).getUser.cooldownUntil, null, 'an expired cooldown is not shown');
  const created = (await ok(CREATE, { hostId: idOf(target), input: input() }, expired)).createSession.id;
  assert.ok(created, 'can create again after the cooldown ends');
  await ok(JOIN, { s: openSession, u: idOf(target) }, expired);
  console.log('✓ Create and join work again once the cooldown has ended');

  // A rating that raises the average (still under 2) doesn't start a new one.
  const raised = await rate(rater, target, 2);
  assert.ok(raised.socialRating < 2);
  assert.ok(raised.cooldownUntil < new Date(), 'a rating that raises the average starts no cooldown');
  // One that pulls it down again does.
  const lowered = await rate(rater, target, 1);
  assert.ok(lowered.cooldownUntil > new Date(), 'a new drop starts a new cooldown');
  console.log('✓ After expiry, only a rating that lowers the average again restarts the cooldown');

  // ---- the threshold, as the rating is shown (one decimal) ---------------
  async function startsCooldown(name, ratingSum, totalRatings, value) {
    const socialRating = totalRatings ? Math.round((ratingSum / totalRatings) * 10) / 10 : 0;
    const user = await makeUser(name, { ratingSum, totalRatings, socialRating });
    const after = await rate(rater, user, value);
    return { rating: after.socialRating, cooldown: Boolean(after.cooldownUntil) };
  }
  assert.deepEqual(await startsCooldown('exactly2', 5, 2, 1), { rating: 2, cooldown: false }, '2.0 is not below 2');
  assert.deepEqual(await startsCooldown('rounds-to-2', 48, 24, 1), { rating: 2, cooldown: false }, '1.96 shows as 2.0');
  assert.deepEqual(await startsCooldown('just-under', 96, 49, 1), { rating: 1.9, cooldown: true }, '1.94 shows as 1.9');
  assert.deepEqual(await startsCooldown('first-rating-2', 0, 0, 2), { rating: 2, cooldown: false });
  console.log('✓ The cooldown starts below 2.0 as shown in the app, not at it');

  console.log('Cooldown tests passed');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  const users = await User.find({ email: { $in: createdEmails } }, '_id');
  const userIds = users.map((user) => user._id);
  const sessions = await Session.find({ $or: [{ host: { $in: userIds } }, { participants: { $in: userIds } }] }, '_id');
  const sessionIds = sessions.map((session) => session._id);
  await Promise.all([
    Rating.deleteMany({ session: { $in: sessionIds } }),
    Session.deleteMany({ _id: { $in: sessionIds } }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  await server.stop();
  await mongoose.disconnect();
}
