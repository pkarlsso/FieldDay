// Shared setup for the in-process GraphQL tests: connects to MONGODB_URI, runs
// the schema without an HTTP server, and tracks the users each test creates so
// they (and their sessions, ratings and photos) can be deleted afterwards.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { getConfig } from '../../backend/src/config.js';
import typeDefs from '../../backend/src/graphql/typeDefs.js';
import resolvers from '../../backend/src/graphql/resolvers.js';
import User from '../../backend/src/models/User.js';
import Session from '../../backend/src/models/Session.js';
import Rating from '../../backend/src/models/Rating.js';
import Media from '../../backend/src/models/Media.js';
import AuthSession from '../../backend/src/models/AuthSession.js';

export const HOUR = 60 * 60 * 1000;

export async function startHarness(tag) {
  await mongoose.connect(getConfig().mongoUri);
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  const createdEmails = [];

  // `currentUser` stands in for whoever the request's bearer token belongs to.
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

  // Returns the first error so callers can also check its code.
  async function fails(query, variables, currentUser, expected) {
    const result = await run(query, variables, currentUser);
    assert.ok(result.errors, `expected an error containing "${expected}"`);
    const [error] = result.errors;
    assert.ok(error.message.includes(expected), `expected "${error.message}" to include "${expected}"`);
    return error;
  }

  async function createUsers(names, fields = {}) {
    return Promise.all(names.map((name) => {
      const email = `${tag}-${name}@example.test`;
      createdEmails.push(email);
      return User.create({ name, email, ...fields });
    }));
  }

  // Re-reads a user, as the server does for every request.
  const fresh = (user) => User.findById(user._id);

  async function stop() {
    const users = await User.find({ email: { $in: createdEmails } }, '_id');
    const userIds = users.map((user) => user._id);
    const sessions = await Session.find({ host: { $in: userIds } }, '_id');
    const sessionIds = sessions.map((session) => session._id);
    await Promise.all([
      Rating.deleteMany({ session: { $in: sessionIds } }),
      Session.deleteMany({ _id: { $in: sessionIds } }),
      Media.deleteMany({ owner: { $in: userIds } }),
      AuthSession.deleteMany({ user: { $in: userIds } }),
      User.deleteMany({ _id: { $in: userIds } })
    ]);
    await server.stop();
    await mongoose.disconnect();
  }

  return { run, ok, fails, createUsers, fresh, stop };
}

export const idOf = (user) => String(user._id);

export function sessionInput(overrides = {}) {
  return {
    sport: 'Pickleball',
    startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    location: 'Harness Test Court',
    locationPoint: { longitude: -86.9147, latitude: 40.4259 },
    maxParticipants: 4,
    skillLevel: 2,
    ...overrides
  };
}

// Shifts a stored session so it started `startedHoursAgo` and ends `endsInHours` from now.
export function moveSession(id, startedHoursAgo, endsInHours) {
  return Session.updateOne(
    { _id: id },
    { startsAt: new Date(Date.now() - startedHoursAgo * HOUR), endsAt: new Date(Date.now() + endsInHours * HOUR) }
  );
}

// Runs a test body and makes a failure end the process with a non-zero code.
// The shared winston logger handles uncaught errors without exiting, which
// would otherwise let a failing run end with exit code 0.
export async function runTest(harness, body) {
  try {
    await body();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await harness.stop();
  }
}
