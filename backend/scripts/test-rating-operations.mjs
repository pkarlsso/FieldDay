// Post-session rating integration tests. Each run uses an in-memory MongoDB
// instance, so it cannot affect development or shared test data.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { MongoMemoryServer } from 'mongodb-memory-server';
import typeDefs from '../src/graphql/typeDefs.js';
import resolvers from '../src/graphql/resolvers.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import Rating from '../src/models/Rating.js';
import FriendRequest from '../src/models/FriendRequest.js';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('fieldday-rating-operations');

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

async function fails(query, variables, currentUser, expectedMessage) {
  const result = await run(query, variables, currentUser);
  assert.ok(result.errors, `expected an error containing "${expectedMessage}"`);
  assert.ok(
    result.errors[0].message.includes(expectedMessage),
    `expected "${result.errors[0].message}" to include "${expectedMessage}"`
  );
}

const SUBMIT = `mutation SubmitRatings($sessionId: ID!, $ratings: [RatingInput!]!) {
  submitRatings(sessionId: $sessionId, ratings: $ratings) {
    success
    avgRatingGiven
    friendRequestsSent
    updatedUsers { id socialRating }
  }
}`;

const idOf = (document) => String(document._id);
const report = (message) => process.stdout.write(`${message}\n`);

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const [rater, playerOne, playerTwo, outsider] = await Promise.all(
    ['rater', 'player-one', 'player-two', 'outsider'].map((name) => User.create({
      name,
      email: `${name}@rating-test.example`
    }))
  );
  const session = await Session.create({
    sport: 'Pickleball',
    date: '2026-10-31',
    time: '18:00',
    startsAt: new Date('2026-10-30T18:00:00.000Z'),
    location: 'Rating Test Court',
    locationPoint: { type: 'Point', coordinates: [-86.9147, 40.4259] },
    participants: [rater._id, playerOne._id, playerTwo._id],
    host: rater._id,
    status: 'completed'
  });
  const sessionId = idOf(session);
  const rateeIds = [idOf(playerOne), idOf(playerTwo)];

  await fails(SUBMIT, { sessionId, ratings: [] }, rater, 'Submit at least one rating');
  await fails(SUBMIT, { sessionId, ratings: [{ userId: rateeIds[0], rating: 6 }] }, rater, 'whole numbers from 1 to 5');
  await fails(SUBMIT, { sessionId, ratings: [{ userId: idOf(rater), rating: 4 }] }, rater, 'cannot rate yourself');
  await fails(SUBMIT, { sessionId, ratings: [{ userId: rateeIds[0], rating: 4 }] }, outsider, 'Only people who played');
  assert.equal(await Rating.countDocuments(), 0, 'invalid submissions persist no ratings');
  report('✓ Empty, invalid, self, and unauthorized rating submissions are rejected');

  const data = await ok(SUBMIT, {
    sessionId,
    ratings: [
      { userId: rateeIds[0], rating: 5, addFriend: true },
      { userId: rateeIds[1], rating: 3, addFriend: false }
    ]
  }, rater);
  assert.deepEqual(data.submitRatings, {
    success: true,
    avgRatingGiven: 4,
    friendRequestsSent: 1,
    updatedUsers: [
      { id: rateeIds[0], socialRating: 5 },
      { id: rateeIds[1], socialRating: 3 }
    ]
  });
  assert.deepEqual(
    (await Rating.find({}, 'rater ratee value').sort({ ratee: 1 })).map((rating) => ({
      rater: String(rating.rater),
      ratee: String(rating.ratee),
      value: rating.value
    })),
    [
      { rater: idOf(rater), ratee: rateeIds[0], value: 5 },
      { rater: idOf(rater), ratee: rateeIds[1], value: 3 }
    ].sort((left, right) => left.ratee.localeCompare(right.ratee)),
    'successful submissions persist one rating per ratee'
  );
  assert.equal(
    await FriendRequest.countDocuments({ requester: rater._id, recipient: playerOne._id, status: 'pending' }),
    1,
    'addFriend creates a pending friend request'
  );
  report('✓ Valid ratings persist, calculate the average, and create requested friend links');

  await fails(
    SUBMIT,
    { sessionId, ratings: [{ userId: rateeIds[0], rating: 4 }] },
    rater,
    'already rated this session'
  );
  assert.equal(await Rating.countDocuments(), 2, 'duplicate submissions persist no extra ratings');
  report('✓ Duplicate rating submissions are rejected');

  report('Rating operation integration tests passed');
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
} finally {
  await server.stop();
  await mongoose.disconnect();
  await mongo.stop();
}
