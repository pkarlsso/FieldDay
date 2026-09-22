/* global console */
// Comprehensive tests for sport preferences and skill levels feature
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ApolloServer } = require('@apollo/server');
const { getConfig } = require('../backend/src/config.js');
const typeDefs = require('../backend/src/graphql/typeDefs.js');
const resolvers = require('../backend/src/graphql/resolvers.js');
const User = require('../backend/src/models/User.js');

const tag = `sport-test-${Date.now()}`;
const emailFor = (name) => `${tag}-${name}@example.test`;

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

const createdEmails = [];

try {
  await mongoose.connect(getConfig().mongoUri);
  await User.init();

  console.log('Testing sport preferences and skill levels feature...');

  // Test 1: Create user with sport skills
  const testUser = await User.create({
    name: 'Test User',
    email: emailFor('test1'),
    sportSkills: [
      { sport: 'Pickleball', skillLevel: 4 },
      { sport: 'Tennis', skillLevel: 3 }
    ]
  });
  createdEmails.push(emailFor('test1'));

  assert.equal(testUser.sportSkills.length, 2);
  assert.equal(testUser.sportSkills[0].sport, 'Pickleball');
  assert.equal(testUser.sportSkills[0].skillLevel, 4);
  console.log('✓ User creation with sport skills works');

  // Test 2: Update profile with sport skills via GraphQL
  const updateMutation = `mutation($i:UpdateProfileInput!){updateProfile(input:$i){
    id name sportSkills{sport skillLevel} }}`;

  const updated = (await ok(updateMutation, {
    i: {
      name: 'Updated User',
      sportSkills: [
        { sport: 'Basketball', skillLevel: 5 },
        { sport: 'Soccer', skillLevel: 2 },
        { sport: 'Volleyball', skillLevel: 4 }
      ]
    }
  }, testUser)).updateProfile;

  assert.equal(updated.sportSkills.length, 3);
  assert.equal(updated.sportSkills[0].sport, 'Basketball');
  assert.equal(updated.sportSkills[0].skillLevel, 5);
  console.log('✓ GraphQL updateProfile with sport skills works');

  // Test 3: Validate skill level constraints (1-5)
  await fails(updateMutation, {
    i: {
      sportSkills: [{ sport: 'Golf', skillLevel: 6 }]
    }
  }, testUser, 'whole number from 1 to 5');
  console.log('✓ Skill level validation (max 5) works');

  await fails(updateMutation, {
    i: {
      sportSkills: [{ sport: 'Golf', skillLevel: 0 }]
    }
  }, testUser, 'whole number from 1 to 5');
  console.log('✓ Skill level validation (min 1) works');

  // Test 4: Validate no duplicate sports
  await fails(updateMutation, {
    i: {
      sportSkills: [
        { sport: 'Pickleball', skillLevel: 3 },
        { sport: 'pickleball', skillLevel: 4 }
      ]
    }
  }, testUser, 'more than once');
  console.log('✓ Duplicate sport validation works');

  // Test 5: Validate max sports limit (10)
  const manySports = Array.from({ length: 11 }, (_, i) => ({
    sport: `Sport${i}`,
    skillLevel: 3
  }));
  await fails(updateMutation, {
    i: { sportSkills: manySports }
  }, testUser, 'at most 10');
  console.log('✓ Max sports limit validation works');

  // Test 6: Query user and verify sport skills are returned
  const query = `query($id:ID!){getUser(id:$id){sportSkills{sport skillLevel}}}`;
  const queried = (await ok(query, { id: String(testUser._id) })).getUser;
  assert.equal(queried.sportSkills.length, 3);
  console.log('✓ GraphQL query returns sport skills correctly');

  // Test 7: Test backward compatibility with legacy format
  const legacyUser = await User.create({
    name: 'Legacy User',
    email: emailFor('legacy'),
    sports: ['Tennis', 'Golf'],
    skillLevel: 3
  });
  createdEmails.push(emailFor('legacy'));

  const legacyQueried = (await ok(query, { id: String(legacyUser._id) })).getUser;
  assert.equal(legacyQueried.sportSkills.length, 2);
  assert.equal(legacyQueried.sportSkills[0].sport, 'Tennis');
  assert.equal(legacyQueried.sportSkills[0].skillLevel, 3);
  console.log('✓ Backward compatibility with legacy sports format works');

  // Test 8: Test sport name length validation
  await fails(updateMutation, {
    i: {
      sportSkills: [{ sport: 'A'.repeat(31), skillLevel: 3 }]
    }
  }, testUser, 'Sport name must be');
  console.log('✓ Sport name length validation works');

  // Test 9: Test empty sport name validation
  await fails(updateMutation, {
    i: {
      sportSkills: [{ sport: '   ', skillLevel: 3 }]
    }
  }, testUser, 'Sport name cannot be empty');
  console.log('✓ Empty sport name validation works');

  // Test 10: Test partial update (only update sports, keep other fields)
  const partialUpdate = (await ok(updateMutation, {
    i: {
      sportSkills: [{ sport: 'Running', skillLevel: 5 }]
    }
  }, testUser)).updateProfile;
  assert.equal(partialUpdate.name, 'Updated User'); // Name should remain unchanged
  assert.equal(partialUpdate.sportSkills.length, 1);
  assert.equal(partialUpdate.sportSkills[0].sport, 'Running');
  console.log('✓ Partial update with only sport skills works');

  console.log('\n✅ All sport preferences and skill levels tests passed!');

} finally {
  const users = await User.find({ email: { $in: createdEmails } }, '_id');
  const userIds = users.map((user) => user._id);
  await User.deleteMany({ _id: { $in: userIds } });
  await mongoose.disconnect();
  await server.stop();
}