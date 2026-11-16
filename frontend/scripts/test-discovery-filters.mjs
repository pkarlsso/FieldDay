import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DISCOVERY_RADIUS_MILES,
  isWithinDiscoveryRadius,
  normalizeDiscoveryRadius,
  withDiscoveryRadius,
} from '../src/fieldday/discoveryFilters.js';

const origin = { latitude: 40.4259, longitude: -86.9147 };

test('normalizes radius values to supported five-mile increments', () => {
  assert.equal(DEFAULT_DISCOVERY_RADIUS_MILES, 25);
  assert.equal(normalizeDiscoveryRadius(28), 30);
  assert.equal(normalizeDiscoveryRadius(1), 5);
  assert.equal(normalizeDiscoveryRadius(200), 100);
});

test('only sends a radius to discovery when an origin is available', () => {
  assert.deepEqual(withDiscoveryRadius({ sports: ['Tennis'] }, origin, 42), {
    sports: ['Tennis'], origin, maxDistanceMiles: 40,
  });
  assert.deepEqual(withDiscoveryRadius({ sports: ['Tennis'], maxDistanceMiles: 50 }, null, 50), {
    sports: ['Tennis'], origin: undefined,
  });
});

test('matches only map sessions inside the selected radius', () => {
  assert.equal(isWithinDiscoveryRadius(origin, { latitude: 40.4302, longitude: -86.9147 }, 5), true);
  assert.equal(isWithinDiscoveryRadius(origin, { latitude: 40.5708, longitude: -86.9147 }, 5), false);
});
