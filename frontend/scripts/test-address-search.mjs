import assert from 'node:assert/strict';
import test from 'node:test';
import { firstGeocodedLocation, validateAddressQuery } from '../src/fieldday/addressSearch.js';

test('requires a meaningful address or venue query', () => {
  assert.match(validateAddressQuery(''), /at least 3 characters/);
  assert.match(validateAddressQuery('  ab '), /at least 3 characters/);
  assert.equal(validateAddressQuery('Co-Rec Courts'), null);
});

test('uses the first geocoding result with valid coordinates', () => {
  assert.deepEqual(firstGeocodedLocation([
    { latitude: Number.NaN, longitude: -86.9 },
    { latitude: 40.4259, longitude: -86.9147 },
  ]), { latitude: 40.4259, longitude: -86.9147 });
});

test('reports no location for empty or invalid geocoding results', () => {
  assert.equal(firstGeocodedLocation([]), null);
  assert.equal(firstGeocodedLocation([{ latitude: '40.4', longitude: -86.9 }]), null);
});
