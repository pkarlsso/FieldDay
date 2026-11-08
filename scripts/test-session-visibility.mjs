// #217: public, friends-only and invite-only sessions.
import assert from 'node:assert/strict';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import { idOf, runTest, sessionInput, startHarness } from './lib/graphqlHarness.mjs';

const harness = await startHarness(`visibility-test-${Date.now()}`);
const { ok, fails, createUsers, fresh } = harness;

const CREATE = `mutation($i:CreateSessionInput!){createSession(input:$i){
  id visibility invitees{id} participants{id} }}`;
const GET = 'query($id:ID!){getSession(id:$id){id visibility invitees{id}}}';
const DISCOVER = 'query($f:SessionDiscoveryFilterInput){getSessions(status:"upcoming",filter:$f){id}}';
const JOIN = 'mutation($s:ID!){joinSession(sessionId:$s){id participants{id}}}';
const LEAVE = 'mutation($s:ID!){leaveSession(sessionId:$s){id}}';
const INVITE = 'mutation($s:ID!,$u:[ID!]!){inviteToSession(sessionId:$s,userIds:$u){id invitees{id}}}';
const UNINVITE = 'mutation($s:ID!,$u:ID!){uninviteFromSession(sessionId:$s,userId:$u){id invitees{id}}}';
const ORIGIN = { origin: { longitude: -86.9147, latitude: 40.4259 }, maxDistanceMiles: 5 };

const befriend = (a, b) => Promise.all([
  User.updateOne({ _id: a._id }, { $addToSet: { friends: b._id } }),
  User.updateOne({ _id: b._id }, { $addToSet: { friends: a._id } })
]);
const unfriend = (a, b) => Promise.all([
  User.updateOne({ _id: a._id }, { $pull: { friends: b._id } }),
  User.updateOne({ _id: b._id }, { $pull: { friends: a._id } })
]);

await runTest(harness, async () => {
  const [host, friend, invitee, stranger, latecomer] = await createUsers(['host', 'friend', 'invitee', 'stranger', 'latecomer']);
  await befriend(host, friend);

  // ---- Creating sessions ---------------------------------------------------
  await fails(CREATE, { i: sessionInput({ inviteeIds: [idOf(invitee)] }) }, await fresh(host), 'only used for invite-only');
  await fails(CREATE, { i: sessionInput({ visibility: 'FRIENDS', inviteeIds: [idOf(invitee)] }) }, await fresh(host), 'only used for invite-only');
  await fails(CREATE, { i: sessionInput({ visibility: 'INVITE_ONLY', inviteeIds: ['000000000000000000000000'] }) }, await fresh(host), 'could not be found');
  await fails(CREATE, { i: sessionInput({ visibility: 'SECRET' }) }, await fresh(host), 'SessionVisibility');

  const pub = (await ok(CREATE, { i: sessionInput() }, await fresh(host))).createSession;
  const friendsOnly = (await ok(CREATE, { i: sessionInput({ visibility: 'FRIENDS' }) }, await fresh(host))).createSession;
  const inviteOnly = (await ok(CREATE, {
    i: sessionInput({ visibility: 'INVITE_ONLY', inviteeIds: [idOf(invitee), idOf(invitee), idOf(host)] })
  }, await fresh(host))).createSession;
  assert.equal(pub.visibility, 'PUBLIC', 'public is the default');
  assert.equal(friendsOnly.visibility, 'FRIENDS');
  assert.deepEqual(inviteOnly.invitees.map((u) => u.id), [idOf(invitee)], 'duplicates and the host are dropped from invites');
  // Stored before visibility existed: no field at all.
  const legacy = await Session.collection.insertOne({
    sport: 'Tennis', date: '2030-01-01', time: '10:00', startsAt: new Date(Date.now() + 48 * 3600000),
    location: 'Old Court', locationPoint: { type: 'Point', coordinates: [-86.9147, 40.4259] },
    maxParticipants: 4, participants: [host._id], host: host._id, status: 'upcoming', tags: []
  });
  const legacyId = String(legacy.insertedId);
  console.log('✓ Hosts choose public, friends-only or invite-only when creating a session');

  // ---- Discovery and details -----------------------------------------------
  const ours = new Set([pub.id, friendsOnly.id, inviteOnly.id, legacyId]);
  const discover = async (user, filter = {}) => (await ok(DISCOVER, { f: filter }, user)).getSessions
    .map((s) => s.id).filter((id) => ours.has(id)).sort();
  const expected = (...ids) => ids.sort();

  for (const filter of [{}, ORIGIN]) {
    assert.deepEqual(await discover(null, filter), expected(pub.id, legacyId), 'signed out: public only');
    assert.deepEqual(await discover(await fresh(stranger), filter), expected(pub.id, legacyId), 'stranger: public only');
    assert.deepEqual(await discover(await fresh(friend), filter), expected(pub.id, legacyId, friendsOnly.id), 'friend: + friends-only');
    assert.deepEqual(await discover(await fresh(invitee), filter), expected(pub.id, legacyId, inviteOnly.id), 'invitee: + invite-only');
    assert.deepEqual(await discover(await fresh(host), filter), expected(pub.id, legacyId, friendsOnly.id, inviteOnly.id), 'host: all');
  }
  console.log('✓ Discovery (list and map radius search) only returns sessions the caller may see');

  await fails(GET, { id: friendsOnly.id }, await fresh(stranger), 'Session not found');
  await fails(GET, { id: inviteOnly.id }, await fresh(stranger), 'Session not found');
  await fails(GET, { id: inviteOnly.id }, null, 'Session not found');
  await fails(GET, { id: inviteOnly.id }, await fresh(friend), 'Session not found');
  assert.equal((await ok(GET, { id: friendsOnly.id }, await fresh(friend))).getSession.id, friendsOnly.id);
  const inviteeView = (await ok(GET, { id: inviteOnly.id }, await fresh(invitee))).getSession;
  assert.deepEqual(inviteeView.invitees, [], 'only the host sees who was invited');
  assert.equal((await ok(GET, { id: legacyId }, null)).getSession.visibility, 'PUBLIC', 'older sessions are public');
  console.log('✓ Session details are hidden from people who may not see the session');

  // ---- Joining ------------------------------------------------------------
  await fails(JOIN, { s: friendsOnly.id }, await fresh(stranger), 'Session not found');
  await fails(JOIN, { s: inviteOnly.id }, await fresh(stranger), 'Session not found');
  await fails(JOIN, { s: inviteOnly.id }, await fresh(friend), 'Session not found');
  assert.equal((await Session.findById(friendsOnly.id)).participants.length, 1, 'rejected joins store nothing');
  await ok(JOIN, { s: friendsOnly.id }, await fresh(friend));
  await ok(JOIN, { s: inviteOnly.id }, await fresh(invitee));
  await ok(JOIN, { s: pub.id }, await fresh(stranger));
  console.log('✓ Only friends and invitees can join; anyone can still join public sessions');

  // ---- Invites change access straight away ---------------------------------
  await fails(INVITE, { s: inviteOnly.id, u: [idOf(latecomer)] }, await fresh(invitee), 'Only the host');
  await fails(INVITE, { s: friendsOnly.id, u: [idOf(latecomer)] }, await fresh(host), 'only used for invite-only');
  await fails(INVITE, { s: inviteOnly.id, u: [idOf(latecomer)] }, null, 'signed in');
  await fails(JOIN, { s: inviteOnly.id }, await fresh(latecomer), 'Session not found');
  const invited = (await ok(INVITE, { s: inviteOnly.id, u: [idOf(latecomer)] }, await fresh(host))).inviteToSession;
  assert.deepEqual(invited.invitees.map((u) => u.id).sort(), [idOf(invitee), idOf(latecomer)].sort());
  assert.deepEqual(await discover(await fresh(latecomer)), expected(pub.id, legacyId, inviteOnly.id), 'a new invite shows up in discovery');

  await ok(UNINVITE, { s: inviteOnly.id, u: idOf(latecomer) }, await fresh(host));
  assert.deepEqual(await discover(await fresh(latecomer)), expected(pub.id, legacyId), 'removing an invite hides the session again');
  await fails(JOIN, { s: inviteOnly.id }, await fresh(latecomer), 'Session not found');

  await ok(UNINVITE, { s: inviteOnly.id, u: idOf(invitee) }, await fresh(host));
  assert.ok((await discover(await fresh(invitee))).includes(inviteOnly.id), 'someone who already joined keeps seeing it');
  await ok(LEAVE, { s: inviteOnly.id }, await fresh(invitee));
  await fails(GET, { id: inviteOnly.id }, await fresh(invitee), 'Session not found');
  console.log('✓ Inviting and uninviting take effect immediately; people who joined keep their spot');

  // ---- Friendship changes ---------------------------------------------------
  await unfriend(host, friend);
  assert.ok((await discover(await fresh(friend))).includes(friendsOnly.id), 'a joined ex-friend keeps their spot');
  await ok(LEAVE, { s: friendsOnly.id }, await fresh(friend));
  await fails(JOIN, { s: friendsOnly.id }, await fresh(friend), 'Session not found');
  await befriend(host, latecomer);
  await ok(JOIN, { s: friendsOnly.id }, await fresh(latecomer));
  console.log('✓ Becoming or no longer being friends with the host changes access straight away');

  // ---- addFriend can't be used to get into friends-only sessions -----------
  const ADD_FRIEND = 'mutation($f:ID!){addFriend(friendId:$f){id}}';
  // The stranger is in the host's public session, but it hasn't happened yet.
  await fails(ADD_FRIEND, { f: idOf(host) }, await fresh(stranger), 'played a session with');
  assert.ok(!(await discover(await fresh(stranger))).includes(friendsOnly.id));
  console.log('✓ Strangers cannot make themselves friends of a host');

  console.log('Session visibility tests passed');
});
