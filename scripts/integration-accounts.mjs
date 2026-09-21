/* global console */
// Exercises password reset, Google sign-in, persistent sign-in, profile editing
// and ratings against the database in MONGODB_URI. It runs the GraphQL schema
// in-process (no server needed), stubs out email and Google, and deletes every
// document it creates.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ApolloServer } = require('@apollo/server');
const { getConfig } = require('../backend/src/config.js');
const typeDefs = require('../backend/src/graphql/typeDefs.js');
const resolvers = require('../backend/src/graphql/resolvers.js');
const mailer = require('../backend/src/utils/mailer.js');
const googleAuth = require('../backend/src/utils/googleAuth.js');
const { authenticateRequest } = require('../backend/src/utils/authSession.js');
const User = require('../backend/src/models/User.js');
const Session = require('../backend/src/models/Session.js');
const Rating = require('../backend/src/models/Rating.js');
const AuthSession = require('../backend/src/models/AuthSession.js');

const tag = `accounts-${Date.now()}`;
const emailFor = (name) => `${tag}-${name}@example.test`;
const PASSWORD = 'Sup3r-secret!';
const createdEmails = [];
const codes = { twoFactor: {}, reset: {} };

// The real senders would email a code; capture it instead.
mailer.sendTwoFactorEmail = async (email, code) => { codes.twoFactor[email] = code; };
mailer.sendPasswordResetEmail = async (email, code) => { codes.reset[email] = code; };

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
  return JSON.parse(JSON.stringify(result.data)); // plain objects, so deepEqual compares cleanly
}

async function fails(query, variables, currentUser, expected) {
  const result = await run(query, variables, currentUser);
  assert.ok(result.errors, `expected an error containing "${expected}"`);
  const message = result.errors[0].message;
  assert.ok(message.includes(expected), `expected "${message}" to include "${expected}"`);
}

const AUTH_FIELDS = 'success message userId token requiresTwoFactor';

async function signUpAndVerify(name) {
  const email = emailFor(name);
  createdEmails.push(email);
  const signUp = await ok(`mutation($e:String!,$p:String!){signUp(email:$e,password:$p){${AUTH_FIELDS}}}`, { e: email, p: PASSWORD });
  assert.equal(signUp.signUp.success, true);
  const verify = await ok(
    `mutation($e:String!,$c:String!){verifyTwoFactorCode(email:$e,code:$c){${AUTH_FIELDS}}}`,
    { e: email, c: codes.twoFactor[email] }
  );
  assert.equal(verify.verifyTwoFactorCode.success, true);
  assert.ok(verify.verifyTwoFactorCode.token, 'verification should return a session token');
  return { email, ...verify.verifyTwoFactorCode };
}

const sessionIds = [];

try {
  await mongoose.connect(getConfig().mongoUri);
  await Promise.all([User.init(), Rating.init(), AuthSession.init()]);

  // ---- #104 persistent sign-in -------------------------------------------
  const alice = await signUpAndVerify('alice');
  const restore = 'mutation($t:String!){restoreSession(token:$t){success message userId token}}';

  let restored = await ok(restore, { t: alice.token });
  assert.equal(restored.restoreSession.success, true);
  assert.equal(restored.restoreSession.userId, alice.userId);

  const stored = await AuthSession.findOne({ user: alice.userId });
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(stored.expiresAt - Date.now() - thirtyDays) < 60 * 1000, 'session should last 30 days');
  assert.notEqual(stored.tokenHash, alice.token, 'the raw token must not be stored');

  // Using the app again pushes the expiry out (sliding 30 days).
  await AuthSession.updateOne({ _id: stored._id }, { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  await ok(restore, { t: alice.token });
  const extended = await AuthSession.findById(stored._id);
  assert.ok(extended.expiresAt - Date.now() > thirtyDays - 60 * 1000, 'restoring should renew the 30 days');

  const viaHeader = await authenticateRequest({ headers: { authorization: `Bearer ${alice.token}` } });
  assert.equal(String(viaHeader._id), alice.userId);
  assert.equal(await authenticateRequest({ headers: { authorization: 'Bearer nope' } }), null);
  assert.equal(await authenticateRequest({ headers: {} }), null);

  await AuthSession.updateOne({ _id: stored._id }, { expiresAt: new Date(Date.now() - 1000) });
  restored = await ok(restore, { t: alice.token });
  assert.equal(restored.restoreSession.success, false, 'an expired session must not restore');

  const second = await ok(
    `mutation($e:String!,$p:String!){login(email:$e,password:$p){success}}`,
    { e: alice.email, p: PASSWORD }
  );
  assert.equal(second.login.success, true);
  const secondVerify = await ok(
    `mutation($e:String!,$c:String!){verifyTwoFactorCode(email:$e,code:$c){token}}`,
    { e: alice.email, c: codes.twoFactor[alice.email] }
  );
  await ok('mutation($t:String!){logout(token:$t){success}}', { t: secondVerify.verifyTwoFactorCode.token });
  restored = await ok(restore, { t: secondVerify.verifyTwoFactorCode.token });
  assert.equal(restored.restoreSession.success, false, 'logout must revoke the token');
  restored = await ok(restore, { t: 'not-a-real-token' });
  assert.equal(restored.restoreSession.success, false);

  // ---- #102 forgot password ----------------------------------------------
  const requestReset = 'mutation($e:String!){requestPasswordReset(email:$e){success message}}';
  const reset = 'mutation($e:String!,$c:String!,$p:String!){resetPassword(email:$e,code:$c,newPassword:$p){success message}}';

  const unknown = await ok(requestReset, { e: emailFor('nobody') });
  const known = await ok(requestReset, { e: alice.email });
  assert.deepEqual(unknown.requestPasswordReset, known.requestPasswordReset, 'response must not reveal whether the account exists');
  assert.equal(codes.reset[emailFor('nobody')], undefined, 'no email for an unknown account');
  assert.match(codes.reset[alice.email], /^\d{6}$/);

  const liveSession = (await loginToken(alice.email, PASSWORD));

  const NEW_PASSWORD = 'An0ther-secret!';
  assert.equal((await ok(reset, { e: alice.email, c: '000000', p: 'weak' })).resetPassword.success, false, 'weak password rejected');
  const wrong = await ok(reset, { e: alice.email, c: '000000', p: NEW_PASSWORD });
  assert.equal(wrong.resetPassword.success, false);
  assert.equal((await User.findOne({ email: alice.email })).passwordResetAttempts, 1);
  assert.equal((await ok(reset, { e: alice.email, c: codes.reset[alice.email], p: NEW_PASSWORD })).resetPassword.success, true);
  assert.equal((await ok(reset, { e: alice.email, c: codes.reset[alice.email], p: PASSWORD })).resetPassword.success, false, 'a code works once');

  const oldLogin = await ok('mutation($e:String!,$p:String!){login(email:$e,password:$p){success}}', { e: alice.email, p: PASSWORD });
  assert.equal(oldLogin.login.success, false, 'old password must stop working');
  const newLogin = await ok('mutation($e:String!,$p:String!){login(email:$e,password:$p){success}}', { e: alice.email, p: NEW_PASSWORD });
  assert.equal(newLogin.login.success, true, 'new password must work');
  assert.equal((await ok(restore, { t: liveSession })).restoreSession.success, false, 'reset signs out existing sessions');

  await ok(requestReset, { e: alice.email });
  await User.updateOne({ email: alice.email }, { passwordResetCodeExpires: new Date(Date.now() - 1000) });
  const expiredReset = await ok(reset, { e: alice.email, c: codes.reset[alice.email], p: PASSWORD });
  assert.match(expiredReset.resetPassword.message, /expired/);

  await ok(requestReset, { e: alice.email });
  for (let i = 0; i < 5; i += 1) await ok(reset, { e: alice.email, c: '000000', p: PASSWORD });
  const locked = await ok(reset, { e: alice.email, c: codes.reset[alice.email], p: PASSWORD });
  assert.match(locked.resetPassword.message, /Too many/, 'guessing is rate limited');

  // ---- #103 Google sign-in -----------------------------------------------
  const google = 'mutation($t:String!){googleSignIn(idToken:$t){success message userId token}}';
  let verifiedProfile = { sub: `${tag}-sub-1`, email: emailFor('gina'), emailVerified: true, name: 'Gina Google' };
  googleAuth.verifyGoogleIdToken = async () => verifiedProfile;
  createdEmails.push(emailFor('gina'));

  const created = (await ok(google, { t: 'x' })).googleSignIn;
  assert.equal(created.success, true);
  assert.ok(created.token);
  assert.equal((await User.findById(created.userId)).name, 'Gina Google');
  assert.equal((await ok(restore, { t: created.token })).restoreSession.success, true, 'Google login is persistent');

  const again = (await ok(google, { t: 'x' })).googleSignIn;
  assert.equal(again.userId, created.userId, 'the same Google account maps to the same user');

  verifiedProfile = { sub: `${tag}-sub-2`, email: alice.email.toUpperCase(), emailVerified: true, name: 'Alice G' };
  const linked = (await ok(google, { t: 'x' })).googleSignIn;
  assert.equal(linked.userId, alice.userId, 'links to the existing account with that email');
  assert.equal((await User.findById(alice.userId)).googleId, `${tag}-sub-2`);

  verifiedProfile = { sub: `${tag}-sub-3`, email: alice.email, emailVerified: true, name: 'Impostor' };
  assert.equal((await ok(google, { t: 'x' })).googleSignIn.success, false, 'email already tied to another Google account');

  verifiedProfile = { sub: `${tag}-sub-4`, email: emailFor('unverified'), emailVerified: false, name: 'No' };
  assert.equal((await ok(google, { t: 'x' })).googleSignIn.success, false, 'unverified Google email rejected');
  assert.equal(await User.findOne({ email: emailFor('unverified') }), null);

  googleAuth.verifyGoogleIdToken = async () => { throw new Error('bad token'); };
  assert.equal((await ok(google, { t: 'x' })).googleSignIn.success, false, 'invalid Google token rejected');

  // ---- #105 profile editing ----------------------------------------------
  const update = `mutation($i:UpdateProfileInput!){updateProfile(input:$i){
    id name bio hometown sports skillLevel sportSkills{sport skillLevel} }}`;
  const aliceUser = await User.findById(alice.userId);

  await fails(update, { i: { name: 'Nope' } }, null, 'signed in');

  const edited = (await ok(update, {
    i: {
      name: '  Alice Ace ',
      bio: 'Weekend warrior',
      hometown: 'West Lafayette, IN',
      sportSkills: [{ sport: 'Pickleball', skillLevel: 4 }, { sport: 'Tennis', skillLevel: 3 }]
    }
  }, aliceUser)).updateProfile;
  assert.equal(edited.name, 'Alice Ace');
  assert.equal(edited.hometown, 'West Lafayette, IN');
  assert.deepEqual(edited.sports, ['Pickleball', 'Tennis']);
  assert.equal(edited.skillLevel, 3.5);
  assert.deepEqual(edited.sportSkills, [{ sport: 'Pickleball', skillLevel: 4 }, { sport: 'Tennis', skillLevel: 3 }]);

  const partial = (await ok(update, { i: { bio: '' } }, await User.findById(alice.userId))).updateProfile;
  assert.equal(partial.bio, '');
  assert.equal(partial.name, 'Alice Ace', 'fields that are not sent are left alone');
  assert.equal(partial.sportSkills.length, 2);

  const fresh = () => User.findById(alice.userId);
  await fails(update, { i: { name: '   ' } }, await fresh(), 'cannot be empty');
  await fails(update, { i: { bio: 'x'.repeat(301) } }, await fresh(), 'Bio must be');
  await fails(update, { i: { sportSkills: [{ sport: 'Golf', skillLevel: 9 }] } }, await fresh(), 'whole number from 1 to 5');
  await fails(update, { i: { sportSkills: [{ sport: 'Golf', skillLevel: 2 }, { sport: 'golf', skillLevel: 3 }] } }, await fresh(), 'more than once');
  assert.equal((await fresh()).name, 'Alice Ace', 'a rejected update changes nothing');

  const legacy = await User.create({ name: 'Legacy', email: emailFor('legacy'), sports: ['Soccer'], skillLevel: 2 });
  createdEmails.push(emailFor('legacy'));
  const legacyView = await ok('query($id:ID!){getUser(id:$id){sportSkills{sport skillLevel}}}', { id: String(legacy._id) });
  assert.deepEqual(legacyView.getUser.sportSkills, [{ sport: 'Soccer', skillLevel: 2 }], 'older accounts fall back to sports + skillLevel');

  // ---- #106 ratings backend ----------------------------------------------
  const [host, guest, third, outsider] = await Promise.all(['host', 'guest', 'third', 'outsider'].map((name) => {
    createdEmails.push(emailFor(name));
    return User.create({ name, email: emailFor(name), totalRatings: 2, ratingSum: 8, socialRating: 4 });
  }));
  const makeSession = async (status) => {
    const session = await Session.create({
      sport: 'Pickleball', date: '2026-01-01', time: '10:00', startsAt: new Date('2026-01-01T10:00:00Z'),
      location: 'Test Court', locationPoint: { type: 'Point', coordinates: [-86.9, 40.4] },
      participants: [host._id, guest._id, third._id], host: host._id, status
    });
    sessionIds.push(session._id);
    return session;
  };
  const session = await makeSession('completed');
  const sid = String(session._id);
  const submit = `mutation($s:ID!,$r:ID!,$x:[RatingInput!]!){submitRatings(sessionId:$s,raterId:$r,ratings:$x){
    success avgRatingGiven friendRequestsSent updatedUsers{id socialRating totalRatings} }}`;
  const ids = { host: String(host._id), guest: String(guest._id), third: String(third._id), outsider: String(outsider._id) };
  const rate = (raterId, ratings) => ({ s: sid, r: raterId, x: ratings });

  await fails(submit, rate(ids.host, [{ userId: ids.guest, rating: 6 }]), null, 'whole numbers from 1 to 5');
  await fails(submit, rate(ids.host, [{ userId: ids.guest, rating: 0 }]), null, 'whole numbers from 1 to 5');
  await fails(submit, rate(ids.host, [{ userId: ids.host, rating: 5 }]), null, 'cannot rate yourself');
  await fails(submit, rate(ids.host, [{ userId: ids.outsider, rating: 5 }]), null, 'only rate people who played');
  await fails(submit, rate(ids.outsider, [{ userId: ids.host, rating: 5 }]), null, 'played in the session');
  await fails(submit, rate(ids.host, [{ userId: ids.guest, rating: 5 }, { userId: ids.guest, rating: 4 }]), null, 'only be rated once');
  const upcoming = await makeSession('upcoming');
  await fails(submit, { s: String(upcoming._id), r: ids.host, x: [{ userId: ids.guest, rating: 5 }] }, null, 'completed sessions');
  assert.equal(await Rating.countDocuments({ session: session._id }), 0, 'rejected submissions store nothing');

  const first = (await ok(submit, rate(ids.host, [
    { userId: ids.guest, rating: 5, addFriend: true },
    { userId: ids.third, rating: 3 }
  ]))).submitRatings;
  assert.equal(first.success, true);
  assert.equal(first.avgRatingGiven, 4);
  assert.equal(first.friendRequestsSent, 1);
  const guestAfter = first.updatedUsers.find((user) => user.id === ids.guest);
  assert.equal(guestAfter.totalRatings, 3);
  assert.equal(guestAfter.socialRating, 4.3, '(8 + 5) / 3 rounded to one decimal');
  assert.equal(await Rating.countDocuments({ session: session._id, rater: host._id }), 2, 'each rating is stored');
  assert.deepEqual((await User.findById(guest._id)).friends.map(String), [ids.host], 'friendship is mutual');
  assert.deepEqual((await User.findById(host._id)).friends.map(String), [ids.guest]);

  await fails(submit, rate(ids.host, [{ userId: ids.guest, rating: 1 }]), null, 'already rated');
  assert.equal((await User.findById(guest._id)).totalRatings, 3, 'a repeat submission changes no averages');

  const received = (await ok('query($id:ID!){getRatingsForUser(userId:$id){value session ratee createdAt}}', { id: ids.guest })).getRatingsForUser;
  assert.deepEqual(received.map(({ value, session: s, ratee }) => [value, s, ratee]), [[5, sid, ids.guest]]);
  const given = (await ok('query($s:ID!,$r:ID!){getRatingsBySession(sessionId:$s,raterId:$r){value ratee}}', { s: sid, r: ids.host })).getRatingsBySession;
  assert.equal(given.length, 2);

  const pending = async (userId) => (await ok('query($u:ID!){getCompletedSessions(userId:$u){id rated}}', { u: userId })).getCompletedSessions.map((entry) => entry.id);
  assert.ok(!(await pending(ids.host)).includes(sid), 'rated session leaves the rater\'s to-do list');
  assert.ok((await pending(ids.guest)).includes(sid), 'other players can still rate it');
  assert.equal((await Session.findById(sid)).rated, false);

  await ok(submit, rate(ids.guest, [{ userId: ids.host, rating: 4 }]));
  await ok(submit, rate(ids.third, [{ userId: ids.host, rating: 4 }, { userId: ids.guest, rating: 2 }]));
  assert.equal((await Session.findById(sid)).rated, true, 'rated once everyone has rated');
  assert.equal((await User.findById(host._id)).totalRatings, 4);
  assert.equal((await User.findById(host._id)).socialRating, 4, '(8 + 4 + 4) / 4');

  console.log('Accounts integration test passed: sessions, password reset, Google, profile, ratings');
} finally {
  const users = await User.find({ email: { $in: createdEmails } }, '_id');
  const userIds = users.map((user) => user._id);
  await Promise.all([
    Rating.deleteMany({ session: { $in: sessionIds } }),
    Session.deleteMany({ _id: { $in: sessionIds } }),
    AuthSession.deleteMany({ user: { $in: userIds } }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  await mongoose.disconnect();
  await server.stop();
}

// Signs in through the normal login + 2FA path and returns the session token.
async function loginToken(email, password) {
  await ok('mutation($e:String!,$p:String!){login(email:$e,password:$p){success}}', { e: email, p: password });
  const verified = await ok(
    'mutation($e:String!,$c:String!){verifyTwoFactorCode(email:$e,code:$c){token}}',
    { e: email, c: codes.twoFactor[email] }
  );
  return verified.verifyTwoFactorCode.token;
}
