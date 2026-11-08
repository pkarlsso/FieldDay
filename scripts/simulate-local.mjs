// Synthetic activity only. This deliberately refuses remote or non-simulation databases.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '../backend/test/support/apollo.js';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import resolvers from '../backend/src/graphql/resolvers.js';
import mailer from '../backend/src/utils/mailer.js';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import logger from '../backend/src/utils/logger.js';
import { hasGorseJoins } from '../backend/src/services/gorse.js';

const refuse = (message) => { console.error(message); process.exit(1); };
const uri = process.env.MONGODB_URI || '';
let parsed;
try { parsed = new URL(uri); } catch { refuse('Set MONGODB_URI to a local mongodb:// URL with a fieldday_sim_ database.'); }
if (parsed.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !/^\/fieldday_sim_[a-z0-9_]+$/.test(parsed.pathname) || parsed.username || parsed.password || parsed.search) {
  refuse('Simulation only accepts a credential-free localhost MongoDB URL and a database named fieldday_sim_<name>.');
}
if (process.env.AUTH_DEMO_BYPASS === 'true') refuse('Disable AUTH_DEMO_BYPASS for this test.');
if (process.env.GORSE_BASE_URL && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(process.env.GORSE_BASE_URL)) refuse('Only a local Gorse endpoint is allowed.');
const apiUrl = process.env.SIM_API_URL || '';
if (apiUrl && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/graphql$/.test(apiUrl)) refuse('SIM_API_URL must be a localhost GraphQL URL.');
const count = Number(process.env.SIM_USERS || 30);
const delay = Number(process.env.SIM_DELAY_MS || 0);
if (!Number.isInteger(count) || count < 4 || count > 100 || !Number.isInteger(delay) || delay < 0 || delay > 10000) refuse('SIM_USERS must be 4–100 and SIM_DELAY_MS 0–10000.');
const tag = `sim${Date.now()}`;
const password = 'FielddayLocalTest!2026';
const codes = new Map();
mailer.sendTwoFactorEmail = async (email, code) => codes.set(email, code);
mailer.sendPasswordResetEmail = async () => { throw new Error('Password resets are outside this simulation'); };
logger.exitOnError = true;
const server = new ApolloServer({ typeDefs, resolvers });
const center = { longitude: -86.9147, latitude: 40.4259 };
const sports = ['Basketball', 'Pickleball', 'Soccer', 'Tennis', 'Volleyball'];
async function step(label) { console.log(label); if (delay) await new Promise(resolve => setTimeout(resolve, delay)); }
async function call(query, variables = {}, currentUser = null) {
  const response = await server.executeOperation({ query, variables }, { contextValue: { currentUser } });
  const result = response.body.singleResult;
  if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
  return result.data;
}
try {
  await mongoose.connect(uri);
  await server.start();
  const users = [];
  const tokens = [];
  for (let i = 0; i < count; i++) {
    const email = `${tag}-${i}@example.test`;
    const signup = await call('mutation($e:String!,$p:String!){signUp(email:$e,password:$p){success message userId}}', { e: email, p: password });
    assert.equal(signup.signUp.success, true, signup.signUp.message);
    const verify = await call('mutation($e:String!,$c:String!){verifyTwoFactorCode(email:$e,code:$c){success token userId}}', { e: email, c: codes.get(email) });
    assert.ok(verify.verifyTwoFactorCode.token);
    const user = await User.findById(verify.verifyTwoFactorCode.userId);
    await call('mutation($p:UpdateProfileInput!){updateProfile(input:$p){id}}', { p: { name: `Test Player ${i + 1}`, sportSkills: [{ sport: sports[i % sports.length], skillLevel: 2 }], availability: [{ day: 'MON', periods: ['EVENING'] }] } }, user);
    users.push(user);
    tokens.push(verify.verifyTwoFactorCode.token);
    await step(`Signed up and verified player ${i + 1}/${count}`);
  }
  const created = [];
  for (let i = 0; i < count; i++) {
    const sport = sports[i % sports.length];
    const input = { sport, startsAt: new Date(Date.now() + (i + 2) * 3600000).toISOString(), location: `${tag} Purdue court ${i + 1}`, locationPoint: { longitude: center.longitude + (i % 5) * 0.001, latitude: center.latitude + Math.floor(i / 5) * 0.001 }, maxParticipants: 8, skillLevel: 2 };
    const result = await call('mutation($i:CreateSessionInput!){createSession(input:$i){id sport}}', { i: input }, users[i]);
    created.push(result.createSession);
    await step(`Created ${sport} session ${i + 1}/${count}`);
  }
  const before = await call('query($o:LocationPointInput){recommendedSessions(origin:$o,limit:5){session{id sport} reasons}}', { o: center }, users[0]);
  let joined = 0;
  for (let i = 0; i < count; i++) {
    const other = (i + 1) % count;
    await call('mutation($id:ID!){joinSession(sessionId:$id){id}}', { id: created[other].id }, users[i]);
    joined++;
    await step(`Player ${i + 1} joined player ${other + 1}'s session`);
  }
  for (let i = 0; i < count; i++) {
    const other = (i + 2) % count;
    const result = await call('mutation($id:ID!){sendFriendRequest(recipientId:$id){id}}', { id: String(users[other]._id) }, users[i]);
    if (i % 2 === 0) await call('mutation($id:ID!){acceptFriendRequest(requestId:$id){id status}}', { id: result.sendFriendRequest.id }, users[other]);
    await step(`Player ${i + 1} sent a friend request${i % 2 === 0 ? ' (accepted)' : ' (pending)'}`);
  }
  const notifications = await call('query{getUnreadNotificationCount}', {}, users[2]);
  assert.ok(notifications.getUnreadNotificationCount > 0, 'friend request should create an in-app notification');
  const search = await call('query($f:SessionDiscoveryFilterInput){getSessions(filter:$f){id sport locationPoint{coordinates}}}', { f: { origin: center, maxDistanceMiles: 10, sports: [sports[0]] } }, users[0]);
  assert.ok(search.getSessions.some(s => s.id === created[0].id), 'map discovery should find nearby basketball');
  assert.ok(search.getSessions.every(s => s.sport === sports[0]));
  // Move one test-only session into the past to exercise the real rating mutation. Check-in was removed
  // (#358), so attendance comes from the no-show question, which a player answers before rating.
  const old = created[1].id;
  await Session.updateOne({ _id: old }, { $set: { startsAt: new Date(Date.now() - 3 * 3600000), endsAt: new Date(Date.now() - 3600000) } });
  await call('mutation($s:ID!){reportNoShows(sessionId:$s,noShowUserIds:[]){id}}', { s: old }, users[0]);
  const rating = await call('mutation($s:ID!,$r:[RatingInput!]!){submitRatings(sessionId:$s,ratings:$r){success message}}', { s: old, r: [{ userId: String(users[1]._id), rating: 5 }] }, users[0]);
  assert.equal(rating.submitRatings.success, true, rating.submitRatings.message);
  const after = await call('query($o:LocationPointInput){recommendedSessions(origin:$o,limit:5){session{id sport} reasons}}', { o: center }, users[0]);
  let httpLoad = null;
  if (apiUrl) {
    const started = Date.now();
    const responses = await Promise.all(tokens.map(async token => {
      const response = await fetch(apiUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ query: 'query{me{id} getUnreadNotificationCount}' }), signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      return response.ok && Boolean(body.data?.me?.id) && !body.errors;
    }));
    httpLoad = { concurrentRequests: responses.length, succeeded: responses.filter(Boolean).length, elapsedMs: Date.now() - started };
    assert.equal(httpLoad.succeeded, users.length, 'concurrent HTTP requests must authenticate successfully');
  }
  let gorseFeedbackCount = null;
  if (process.env.GORSE_BASE_URL) {
    for (let attempt = 0; attempt < 10; attempt++) {
      gorseFeedbackCount = (await Promise.all(users.map(user => hasGorseJoins(user)))).filter(Boolean).length;
      if (gorseFeedbackCount === users.length) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(gorseFeedbackCount, users.length, 'all synthetic join events must reach Gorse');
  }
  console.log(JSON.stringify({ httpLoad, gorseUsersWithJoinFeedback: gorseFeedbackCount, database: parsed.pathname.slice(1), run: tag, users: users.length, sessions: created.length, joins: joined, friendRequests: count, accepted: Math.ceil(count / 2), unreadNotificationsForPlayer3: notifications.getUnreadNotificationCount, nearbyBasketballSessions: search.getSessions.length, ratingsSubmitted: 1, recommendationsBefore: before.recommendedSessions.map(x => x.session.sport), recommendationsAfter: after.recommendedSessions.map(x => x.session.sport), note: 'Synthetic data; timing shifted only for the rating test. Ranking changes and real push delivery are not guaranteed.' }, null, 2));
} catch (error) { console.error('Simulation failed:', error.message); process.exitCode = 1; }
finally { await server.stop(); await mongoose.disconnect(); }
