import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExploreRequest, exploreFeedbackState } from '../src/fieldday/exploreDiscoveryState.js';

const origin = { latitude: 40.4259, longitude: -86.9147 };

test('preserves submitted filters and radius when an origin is available', () => {
  const filter = { maxDistanceMiles: 50, sports: ['Tennis'], minSkillLevel: 2, maxSkillLevel: 4 };
  assert.deepEqual(buildExploreRequest(filter, origin), { ...filter, origin });
});

test('does not send a radius without an origin', () => {
  assert.deepEqual(buildExploreRequest({ maxDistanceMiles: 25, sports: ['Soccer'] }, null), { sports: ['Soccer'] });
});

test('reports loading, error, empty, and result feedback states', () => {
  assert.equal(exploreFeedbackState({ loading: true, error: '', sessions: [] }), 'loading');
  assert.equal(exploreFeedbackState({ loading: false, error: 'Network failed', sessions: [] }), 'error');
  assert.equal(exploreFeedbackState({ loading: false, error: '', sessions: [] }), 'empty');
  assert.equal(exploreFeedbackState({ loading: false, error: '', sessions: [{ id: 'session-1' }] }), 'results');
});
