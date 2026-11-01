import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildShapedTables } from '../../src/services/shapedExport.js';

describe('buildShapedTables', () => {
  it('exports shaped users, sessions and interactions without private data', () => {
    const tables = buildShapedTables({
      users: [{
        _id: 'user-1',
        email: 'private@example.com',
        password: 'secret',
        sports: ['Pickleball'],
        sportSkills: [{ sport: 'Pickleball', skillLevel: 4 }],
        socialRating: 4.5,
        createdAt: '2026-10-04T12:00:00.000Z'
      }],
      sessions: [{
        _id: 'session-1',
        sport: 'Pickleball',
        startsAt: '2026-10-10T12:00:00.000Z',
        locationPoint: { coordinates: [-86.9, 40.4] },
        skillMin: 3,
        skillMax: 5,
        tags: ['casual'],
        maxParticipants: 4,
        participants: ['user-1'],
        status: 'upcoming',
        createdAt: '2026-10-04T12:00:00.000Z'
      }],
      ratings: [{
        rater: 'user-1',
        session: 'session-1',
        value: 5,
        createdAt: '2026-10-05T12:00:00.000Z'
      }]
    });

    assert.equal(tables.users[0].id, 'user-1');
    assert.deepEqual(tables.users[0].sport_skills, [{ sport: 'Pickleball', skill_level: 4 }]);
    assert.equal(tables.users[0].email, undefined);
    assert.equal(tables.users[0].password, undefined);

    assert.deepEqual(tables.sessions[0], {
      id: 'session-1',
      sport: 'Pickleball',
      starts_at: '2026-10-10T12:00:00.000Z',
      location_latitude: 40.4,
      location_longitude: -86.9,
      skill_min: 3,
      skill_max: 5,
      tags: ['casual'],
      open_spots: 3,
      status: 'upcoming',
      created_at: '2026-10-04T12:00:00.000Z'
    });

    assert.deepEqual(tables.interactions, [
      {
        user_id: 'user-1',
        item_id: 'session-1',
        interaction_type: 'join',
        occurred_at: '2026-10-04T12:00:00.000Z'
      },
      {
        user_id: 'user-1',
        item_id: 'session-1',
        interaction_type: 'rating',
        value: 5,
        occurred_at: '2026-10-05T12:00:00.000Z'
      }
    ]);
  });

  it('uses nulls for missing optional values and never reports negative open spots', () => {
    const { users, sessions, interactions } = buildShapedTables({
      users: [{ _id: 'user-2' }],
      sessions: [{
        _id: 'session-2',
        sport: 'Tennis',
        maxParticipants: 1,
        participants: ['user-1', 'user-2']
      }],
      ratings: []
    });

    assert.deepEqual(users[0], {
      id: 'user-2',
      sports: [],
      sport_skills: [],
      social_rating: 0,
      created_at: null
    });
    assert.deepEqual(sessions[0], {
      id: 'session-2',
      sport: 'Tennis',
      starts_at: null,
      location_latitude: null,
      location_longitude: null,
      skill_min: null,
      skill_max: null,
      tags: [],
      open_spots: 0,
      status: undefined,
      created_at: null
    });
    assert.deepEqual(interactions, [
      {
        user_id: 'user-1',
        item_id: 'session-2',
        interaction_type: 'join',
        occurred_at: null
      },
      {
        user_id: 'user-2',
        item_id: 'session-2',
        interaction_type: 'join',
        occurred_at: null
      }
    ]);
  });
});