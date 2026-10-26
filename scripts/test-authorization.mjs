// #201: the server acts for the user behind the request's token, never for an
// ID the client sends, and protected operations need a signed-in user.
import assert from 'node:assert/strict';
import mailer from '../backend/src/utils/mailer.js';
import { authenticateRequest, createAuthSession } from '../backend/src/utils/authSession.js';
import User from '../backend/src/models/User.js';
import AuthSession from '../backend/src/models/AuthSession.js';
import Session from '../backend/src/models/Session.js';
import Rating from '../backend/src/models/Rating.js';
import { idOf, moveSession, runTest, sessionInput, startHarness } from './lib/graphqlHarness.mjs';

mailer.sendTwoFactorEmail = async () => {};

const harness = await startHarness(`authz-test-${Date.now()}`);
const { run, ok, fails, createUsers, fresh } = harness;

const ID = '000000000000000000000000';
const TINY_JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0]).toString('base64')}`;

// Every operation that acts for a user, with variables that are otherwise valid.
const PROTECTED = {
  createSession: ['mutation($i:CreateSessionInput!){createSession(input:$i){id}}', { i: sessionInput() }],
  joinSession: ['mutation($s:ID!){joinSession(sessionId:$s){id}}', { s: ID }],
  leaveSession: ['mutation($s:ID!){leaveSession(sessionId:$s){id}}', { s: ID }],
  inviteToSession: ['mutation($s:ID!){inviteToSession(sessionId:$s,userIds:[]){id}}', { s: ID }],
  uninviteFromSession: ['mutation($s:ID!){uninviteFromSession(sessionId:$s,userId:$s){id}}', { s: ID }],
  reportNoShows: ['mutation($s:ID!){reportNoShows(sessionId:$s,noShowUserIds:[]){id}}', { s: ID }],
  submitRatings: ['mutation($s:ID!){submitRatings(sessionId:$s,ratings:[]){success}}', { s: ID }],
  addFriend: ['mutation($f:ID!){addFriend(friendId:$f){id}}', { f: ID }],
  uploadProfilePhoto: ['mutation($p:String!){uploadProfilePhoto(image:$p){id}}', { p: TINY_JPEG }],
  updateProfile: ['mutation{updateProfile(input:{bio:"hi"}){id}}', {}],
  getMySessions: ['query{getMySessions{hosted{id}}}', {}],
  getCompletedSessions: ['query{getCompletedSessions{id}}', {}],
  getRatingsBySession: ['query($s:ID!){getRatingsBySession(sessionId:$s){id}}', { s: ID }]
};

const fakeRequest = (authorization) => ({ headers: authorization ? { authorization } : {} });

await runTest(harness, async () => {
  const [alice, bob, carol] = await createUsers(['alice', 'bob', 'carol']);

  // ---- Who is making the request -----------------------------------------
  const token = await createAuthSession(alice._id);
  assert.equal(idOf(await authenticateRequest(fakeRequest(`Bearer ${token}`))), idOf(alice), 'a valid token is that user');
  assert.equal(await authenticateRequest(fakeRequest()), null, 'no header is nobody');
  assert.equal(await authenticateRequest(fakeRequest('Bearer not-a-real-token')), null, 'an unknown token is nobody');
  assert.equal(await authenticateRequest(fakeRequest(token)), null, 'a token without "Bearer" is ignored');
  assert.equal(await authenticateRequest(fakeRequest(`Basic ${token}`)), null);
  const me = (await ok('query{me{id email}}', {}, await authenticateRequest(fakeRequest(`Bearer ${token}`)))).me;
  assert.equal(me.id, idOf(alice), '`me` is the token\'s user');
  assert.equal((await ok('query{me{id}}', {}, null)).me, null);
  console.log('✓ The request\'s bearer token decides who the user is');

  // ---- No signed-in user, no access -----------------------------------------
  for (const [name, [query, variables]] of Object.entries(PROTECTED)) {
    const error = await fails(query, variables, null, 'You must be signed in');
    assert.equal(error.extensions?.code, 'UNAUTHENTICATED', `${name} reports UNAUTHENTICATED`);
  }
  assert.equal(await Session.countDocuments({ host: { $in: [alice._id, bob._id, carol._id] } }), 0, 'nothing was created');
  console.log(`✓ All ${Object.keys(PROTECTED).length} protected operations reject requests without a valid identity`);

  // ---- The old "act as this ID" arguments are gone --------------------------
  const spoofs = [
    ['mutation($h:ID!,$i:CreateSessionInput!){createSession(hostId:$h,input:$i){id}}', { h: idOf(bob), i: sessionInput() }, 'hostId'],
    ['mutation($s:ID!,$u:ID!){joinSession(sessionId:$s,userId:$u){id}}', { s: ID, u: idOf(bob) }, 'userId'],
    ['mutation($s:ID!,$u:ID!){leaveSession(sessionId:$s,userId:$u){id}}', { s: ID, u: idOf(bob) }, 'userId'],
    ['mutation($s:ID!,$r:ID!){submitRatings(sessionId:$s,raterId:$r,ratings:[]){success}}', { s: ID, r: idOf(bob) }, 'raterId'],
    ['mutation($u:ID!,$f:ID!){addFriend(userId:$u,friendId:$f){id}}', { u: idOf(bob), f: idOf(carol) }, 'userId'],
    ['query($u:ID!){getCompletedSessions(userId:$u){id}}', { u: idOf(bob) }, 'userId'],
    ['query($s:ID!,$r:ID!){getRatingsBySession(sessionId:$s,raterId:$r){id}}', { s: ID, r: idOf(bob) }, 'raterId']
  ];
  for (const [query, variables, argument] of spoofs) {
    await fails(query, variables, await fresh(alice), `Unknown argument "${argument}"`);
  }
  console.log('✓ hostId, userId and raterId arguments are rejected by the schema');

  // ---- Every action is taken as the signed-in user --------------------------
  const created = (await ok('mutation($i:CreateSessionInput!){createSession(input:$i){id host{id} participants{id}}}',
    { i: sessionInput({ maxParticipants: 3 }) }, await fresh(alice))).createSession;
  assert.equal(created.host.id, idOf(alice), 'the host is whoever is signed in');
  assert.deepEqual(created.participants.map((p) => p.id), [idOf(alice)]);

  await ok('mutation($s:ID!){joinSession(sessionId:$s){id}}', { s: created.id }, await fresh(bob));
  assert.deepEqual((await Session.findById(created.id)).participants.map(String), [idOf(alice), idOf(bob)], 'bob joined as bob');
  await fails('mutation($s:ID!){leaveSession(sessionId:$s){id}}', { s: created.id }, await fresh(carol), 'not in this session');
  assert.equal((await Session.findById(created.id)).participants.length, 2, 'carol cannot remove bob');

  await ok('mutation($s:ID!){joinSession(sessionId:$s){id}}', { s: created.id }, await fresh(carol));
  await moveSession(created.id, 3, -1);
  const SUBMIT = 'mutation($s:ID!,$x:[RatingInput!]!){submitRatings(sessionId:$s,ratings:$x){success}}';
  const REPORT = 'mutation($s:ID!){reportNoShows(sessionId:$s,noShowUserIds:[]){id}}';
  for (const user of [alice, bob, carol]) await ok(REPORT, { s: created.id }, await fresh(user));
  await ok(SUBMIT, { s: created.id, x: [{ userId: idOf(alice), rating: 5 }] }, await fresh(bob));
  const stored = await Rating.find({ session: created.id });
  assert.deepEqual(stored.map((r) => [String(r.rater), String(r.ratee)]), [[idOf(bob), idOf(alice)]], 'the rater is whoever is signed in');
  await fails(SUBMIT, { s: created.id, x: [{ userId: idOf(alice), rating: 1 }] }, await fresh(bob), 'already rated');

  const given = (await ok('query($s:ID!){getRatingsBySession(sessionId:$s){value ratee}}', { s: created.id }, await fresh(bob))).getRatingsBySession;
  assert.deepEqual(given, [{ value: 5, ratee: idOf(alice) }], 'you see the ratings you gave');
  assert.deepEqual((await ok('query($s:ID!){getRatingsBySession(sessionId:$s){value}}', { s: created.id }, await fresh(carol))).getRatingsBySession,
    [], 'but not anyone else\'s');
  assert.deepEqual((await ok('query{getCompletedSessions{id}}', {}, await fresh(carol))).getCompletedSessions.map((s) => s.id), [created.id]);
  assert.deepEqual((await ok('query{getCompletedSessions{id}}', {}, await fresh(bob))).getCompletedSessions, [], 'bob already rated');

  const ADD_FRIEND = 'mutation($f:ID!){addFriend(friendId:$f){id friends{id}}}';
  await fails(ADD_FRIEND, { f: idOf(alice) }, await fresh(alice), 'cannot add yourself');
  const [dave] = await createUsers(['dave']);
  await fails(ADD_FRIEND, { f: idOf(dave) }, await fresh(alice), 'played a session with');
  const friends = (await ok(ADD_FRIEND, { f: idOf(carol) }, await fresh(alice))).addFriend;
  assert.equal(friends.id, idOf(alice), 'the friendship is added for whoever is signed in');
  assert.deepEqual(friends.friends.map((f) => f.id), [idOf(carol)]);
  assert.deepEqual((await fresh(carol)).friends.map(String), [idOf(alice)], 'and is mutual');

  const profile = (await ok('mutation{updateProfile(input:{bio:"Mine"}){id bio}}', {}, await fresh(bob))).updateProfile;
  assert.equal(profile.id, idOf(bob));
  assert.equal((await fresh(alice)).bio, '', 'editing your profile never touches anyone else\'s');
  console.log('✓ Sessions, joins, leaves, ratings, friends and profile edits act as the signed-in user');

  // ---- The demo switch only skips the emailed code ---------------------------
  const email = `authz-demo-${Date.now()}@example.test`;
  const SIGN_UP = 'mutation($e:String!){signUp(email:$e,password:"Sup3r-secret!"){success token requiresTwoFactor}}';
  const previous = process.env.AUTH_DEMO_BYPASS;
  try {
    delete process.env.AUTH_DEMO_BYPASS;
    const normal = (await run(SIGN_UP, { e: email })).data.signUp;
    assert.deepEqual([normal.requiresTwoFactor, normal.token], [true, null], 'normally a token needs the emailed code');
    process.env.AUTH_DEMO_BYPASS = 'true';
    const demo = (await run('mutation($e:String!){login(email:$e,password:"Sup3r-secret!"){token requiresTwoFactor}}', { e: email })).data.login;
    assert.equal(demo.requiresTwoFactor, false);
    const demoUser = await authenticateRequest(fakeRequest(`Bearer ${demo.token}`));
    assert.equal(demoUser.email, email, 'a demo token is checked like any other');
    await fails('query{getMySessions{hosted{id}}}', {}, null, 'signed in');
  } finally {
    if (previous === undefined) delete process.env.AUTH_DEMO_BYPASS;
    else process.env.AUTH_DEMO_BYPASS = previous;
    const demoAccount = await User.findOne({ email });
    if (demoAccount) await Promise.all([AuthSession.deleteMany({ user: demoAccount._id }), demoAccount.deleteOne()]);
  }
  console.log('✓ AUTH_DEMO_BYPASS only skips the emailed code; requests are still checked');

  console.log('Authorization tests passed');
});
