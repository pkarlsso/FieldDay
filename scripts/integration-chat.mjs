import mongoose from 'mongoose';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getConfig } = require('../backend/src/config.js');
const User = require('../backend/src/models/User.js');
const Session = require('../backend/src/models/Session.js');
const Conversation = require('../backend/src/models/Conversation.js');
const Message = require('../backend/src/models/Message.js');
const AuthSession = require('../backend/src/models/AuthSession.js');
const authSessions = require('../backend/src/utils/authSession.js');

const endpoint = `http://localhost:${getConfig().port}/graphql`;
const tag = `chat-integration-${Date.now()}`;
let users = [];
let session;
let conversationId;
let tokens = new Map();

async function graphql(query, variables, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((error) => error.message).join('; '));
  return body.data;
}

async function expectError(query, variables, token, expected) {
  try {
    await graphql(query, variables, token);
    throw new Error(`Expected error containing: ${expected}`);
  } catch (error) {
    if (!error.message.includes(expected)) throw error;
  }
}

const conversationsQuery = `query { getConversations { id } }`;
const sendMutation = `mutation($conversationId:ID!,$body:String!,$clientMessageId:String!){sendMessage(conversationId:$conversationId,body:$body,clientMessageId:$clientMessageId){id body sender{id}}}`;
const messagesQuery = `query($conversationId:ID!){getConversationMessages(conversationId:$conversationId){messages{id body sender{id}}}}`;

try {
  await mongoose.connect(getConfig().mongoUri);
  users = await User.create([
    { name: 'Chat Host', email: `${tag}-host@example.test` },
    { name: 'Chat Guest', email: `${tag}-guest@example.test` },
    { name: 'Chat Outsider', email: `${tag}-outsider@example.test` }
  ]);
  session = await Session.create({
    sport: 'Pickleball', date: '2026-10-01', time: '22:00', startsAt: new Date('2026-10-01T22:00:00.000Z'),
    location: 'Integration court', locationPoint: { type: 'Point', coordinates: [-86, 40] },
    host: users[0]._id, participants: [users[0]._id, users[1]._id], maxParticipants: 4, status: 'upcoming'
  });
  tokens = new Map(await Promise.all(users.map(async (user) => [String(user._id), await authSessions.createAuthSession(user._id)])));

  await expectError(conversationsQuery, {}, null, 'You must be signed in');
  const listed = await graphql(conversationsQuery, {}, tokens.get(String(users[0]._id)));
  if (listed.getConversations.length !== 1) throw new Error('session conversation was not created');
  conversationId = listed.getConversations[0].id;

  const first = await graphql(sendMutation, { conversationId, body: 'Ready to play?', clientMessageId: 'retry-1' }, tokens.get(String(users[0]._id)));
  const retry = await graphql(sendMutation, { conversationId, body: 'Different body must not replace this', clientMessageId: 'retry-1' }, tokens.get(String(users[0]._id)));
  if (first.sendMessage.id !== retry.sendMessage.id) throw new Error('message retry was not idempotent');
  await expectError(sendMutation, { conversationId, body: 'Unauthorized', clientMessageId: 'outsider-1' }, tokens.get(String(users[2]._id)), 'cannot access');

  await Session.updateOne({ _id: session._id }, { $pull: { participants: users[1]._id } });
  await expectError(sendMutation, { conversationId, body: 'I left', clientMessageId: 'former-1' }, tokens.get(String(users[1]._id)), 'no longer send');
  const history = await graphql(messagesQuery, { conversationId }, tokens.get(String(users[1]._id)));
  if (history.getConversationMessages.messages.length !== 1) throw new Error('former participant lost read access');

  console.log('Integration chat test passed: authorization -> persistence -> retry -> read-only history');
} finally {
  if (conversationId) await Message.deleteMany({ conversation: conversationId });
  if (session) await Session.deleteOne({ _id: session._id });
  if (conversationId) await Conversation.deleteOne({ _id: conversationId });
  if (users.length) {
    await AuthSession.deleteMany({ user: { $in: users.map(({ _id }) => _id) } });
    await User.deleteMany({ _id: { $in: users.map(({ _id }) => _id) } });
  }
  await mongoose.disconnect();
}