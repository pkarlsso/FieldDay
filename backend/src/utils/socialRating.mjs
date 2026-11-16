const DAY_MS = 24 * 60 * 60 * 1000;

export const SOCIAL_RATING_POLICY = {
  warmupRatings: 10,
  freshWindowDays: 30,
  recentWindowDays: 90,
  freshWeight: 0.5,
  recentWeight: 0.3,
  allTimeWeight: 0.2,
  unlimitedRating: 4.5
};

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function calculateSocialRating(ratings, now = new Date()) {
  const allTimeValues = ratings.map((rating) => rating.value);
  const allTimeAverage = average(allTimeValues);
  if (allTimeAverage === null) return 0;

  const freshSince = now.getTime() - SOCIAL_RATING_POLICY.freshWindowDays * DAY_MS;
  const recentSince = now.getTime() - SOCIAL_RATING_POLICY.recentWindowDays * DAY_MS;
  const freshAverage = average(ratings
    .filter((rating) => new Date(rating.createdAt).getTime() >= freshSince)
    .map((rating) => rating.value)) ?? allTimeAverage;
  const recentAverage = average(ratings
    .filter((rating) => new Date(rating.createdAt).getTime() >= recentSince)
    .map((rating) => rating.value)) ?? allTimeAverage;

  return rounded(
    freshAverage * SOCIAL_RATING_POLICY.freshWeight
    + recentAverage * SOCIAL_RATING_POLICY.recentWeight
    + allTimeAverage * SOCIAL_RATING_POLICY.allTimeWeight
  );
}

export function ratingCount(ratings) {
  return ratings.length;
}