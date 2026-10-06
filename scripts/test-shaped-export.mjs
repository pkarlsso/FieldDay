import assert from 'node:assert/strict';
import { buildShapedTables } from '../backend/src/services/shapedExport.js';

const tables = buildShapedTables({
  users: [{
    _id: 'user-1',
    email: 'private@example.com',
    sports: ['Pickleball'],
    sportSkills: [{ sport: 'Pickleball', skillLevel: 4 }],
    socialRating: 4.5,
    createdAt: '2026-10-04T12:00:00.000Z'
  }],
  sessions: [{
    _id: 'session-1', sport: 'Pickleball', startsAt: '2026-10-10T12:00:00.000Z',
    locationPoint: { coordinates: [-86.9, 40.4] }, skillMin: 3, skillMax: 5,
    tags: ['casual'], maxParticipants: 4, participants: ['user-1'], status: 'upcoming',
    createdAt: '2026-10-04T12:00:00.000Z'
  }],
  ratings: [{ rater: 'user-1', session: 'session-1', value: 5, createdAt: '2026-10-05T12:00:00.000Z' }]
});

assert.equal(tables.users[0].email, undefined, 'PII must not be exported');
assert.deepEqual(tables.sessions[0].open_spots, 3);
assert.deepEqual(tables.interactions.map(({ interaction_type }) => interaction_type), ['join', 'rating']);
console.log('Shaped export transformation passed.');
