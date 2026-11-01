import SessionRegistration from '../models/SessionRegistration.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export const PARTICIPATION_TIERS = [
  { minimumRating: 4.5, limit: null, windowDays: null },
  { minimumRating: 4.0, limit: 5, windowDays: 7 },
  { minimumRating: 3.5, limit: 2, windowDays: 7 },
  { minimumRating: 3.0, limit: 1, windowDays: 7 },
  { minimumRating: 2.5, limit: 1, windowDays: 14 },
  { minimumRating: 0, limit: 1, windowDays: 30 }
];

// Someone nobody has rated yet has a stored rating of 0, which would put them
// in the lowest tier as if they had been rated badly. Until their first rating
// they get the same allowance as a 4.0 player.
export const NEW_PLAYER_TIER = { minimumRating: null, limit: 5, windowDays: 7 };

export function getParticipationTier(rating = 0) {
  return PARTICIPATION_TIERS.find((tier) => rating >= tier.minimumRating);
}

export function getParticipationTierForUser(user) {
  return user.totalRatings > 0 ? getParticipationTier(user.socialRating) : NEW_PLAYER_TIER;
}

export async function assertCanRegister(user, now = new Date()) {
  const tier = getParticipationTierForUser(user);
  if (tier.limit === null) return tier;

  const since = new Date(now.getTime() - tier.windowDays * DAY_MS);
  const count = await SessionRegistration.countDocuments({
    user: user._id,
    registeredAt: { $gte: since, $lte: now }
  });

  if (count >= tier.limit) {
    const who = tier === NEW_PLAYER_TIER ? 'Until you have been rated, you can make' : 'Your rating allows';
    throw new Error(
      `${who} ${tier.limit} new session registration${tier.limit === 1 ? '' : 's'} `
      + `per rolling ${tier.windowDays} days.`
    );
  }

  return tier;
}

export function recordRegistration(sessionId, userId, registeredAt = new Date()) {
  return SessionRegistration.create({ session: sessionId, user: userId, registeredAt });
}