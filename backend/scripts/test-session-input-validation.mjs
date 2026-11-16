import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSessionInput } from '../src/graphql/resolvers.js';

const longPurdueVenue = 'France A. Cordova Recreational Sports Center, Purdue University, 355 North Martin Jischke Drive, West Lafayette, Indiana 47907, United States';
const tooLongVenue = `${longPurdueVenue}${'x'.repeat(256 - longPurdueVenue.length)}`;

function validInput(overrides = {}) {
  return {
    sport: 'Pickleball',
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    location: 'Station 21 West Lafayette',
    locationPoint: { longitude: -86.9147, latitude: 40.4259 },
    skillLevel: 2,
    maxParticipants: 4,
    ...overrides
  };
}

test('accepts and preserves a location name longer than 120 characters', () => {
  assert.ok(longPurdueVenue.length > 120);
  const session = formatSessionInput(validInput({ location: longPurdueVenue }));
  assert.equal(session.location, longPurdueVenue);
});

test('rejects a location name longer than 255 characters', () => {
  assert.equal(tooLongVenue.length, 256);
  assert.throws(
    () => formatSessionInput(validInput({ location: tooLongVenue })),
    /Location must be 255 characters or fewer/
  );
});
