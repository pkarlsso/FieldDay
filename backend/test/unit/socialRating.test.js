import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSocialRating, SOCIAL_RATING_POLICY } from '../../src/utils/socialRating.mjs';
import { getParticipationTierForUser, NEW_PLAYER_TIER, getParticipationTier } from '../../src/utils/participationLimits.mjs';

describe('social rating policy', () => {
  it('blends fresh, recent, and all-time averages at 50/30/20', () => {
    const now = new Date('2026-11-15T00:00:00Z');
    const ratings = [
      { value: 5, createdAt: '2026-11-14T00:00:00Z' },
      { value: 1, createdAt: '2026-10-01T00:00:00Z' },
      { value: 3, createdAt: '2026-01-01T00:00:00Z' }
    ];

    assert.equal(calculateSocialRating(ratings, now), 4);
  });

  it('uses the all-time average when a time window has no ratings', () => {
    const now = new Date('2026-11-15T00:00:00Z');
    const ratings = [{ value: 4, createdAt: '2026-01-01T00:00:00Z' }];

    assert.equal(calculateSocialRating(ratings, now), 4);
  });

  it('keeps users in the new-player tier until ten ratings exist', () => {
    assert.deepEqual(
      getParticipationTierForUser({ totalRatings: SOCIAL_RATING_POLICY.warmupRatings - 1, socialRating: 1 }),
      NEW_PLAYER_TIER
    );
    assert.deepEqual(
      getParticipationTierForUser({ totalRatings: SOCIAL_RATING_POLICY.warmupRatings, socialRating: 1 }),
      getParticipationTier(1)
    );
  });
});
