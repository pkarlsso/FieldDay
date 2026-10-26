const SESSION_SKILL_BANDS = {
  1: { min: 1, max: 2 },
  2: { min: 2, max: 4 },
  3: { min: 4, max: 5 },
};

const MILES_TO_METERS = 1609.344;
const EARTH_RADIUS_MILES = 3958.7613;

function normalizedSport(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function userSportSkills(user) {
  if (user.sportSkills?.length) return user.sportSkills;
  return (user.sports || []).map((sport) => ({ sport, skillLevel: user.skillLevel ?? 3 }));
}

function skillBand(session) {
  if (SESSION_SKILL_BANDS[session.skillLevel]) return SESSION_SKILL_BANDS[session.skillLevel];
  const min = Number(session.skillMin);
  const max = Number(session.skillMax);
  if (Number.isFinite(min) && Number.isFinite(max)) return { min, max };
  const range = String(session.skillRange || '').match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*$/);
  return range ? { min: Number(range[1]), max: Number(range[2]) } : null;
}

function distanceMiles(session, origin) {
  if (!origin || !session.locationPoint?.coordinates) return null;
  const [longitude, latitude] = session.locationPoint.coordinates;
  const latDelta = (latitude - origin.latitude) * Math.PI / 180;
  const lonDelta = (longitude - origin.longitude) * Math.PI / 180;
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(origin.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180)
      * Math.sin(lonDelta / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreSession(session, user, origin) {
  let score = 0;
  const reasons = [];
  const preference = userSportSkills(user).find(
    (entry) => normalizedSport(entry.sport) === normalizedSport(session.sport),
  );

  if (preference) {
    score += 40;
    reasons.push('Matches a sport you play');
    const band = skillBand(session);
    const userLevel = Number(preference.skillLevel ?? user.skillLevel ?? 3);
    if (band && userLevel >= band.min && userLevel <= band.max) {
      score += 25;
      reasons.push('Fits your skill level');
    }
  }

  const distance = distanceMiles(session, origin);
  if (distance !== null) {
    score += Math.max(0, 20 * (1 - distance / 50));
    reasons.push(`${distance.toFixed(1)} miles away`);
  }

  const spots = Math.max(0, session.maxParticipants - (session.participants?.length || 0));
  if (spots > 0) {
    score += 10;
    reasons.push('Has open spots');
  }

  // A near-term boost keeps the feed useful while a new account has little history.
  const hoursUntilStart = Math.max(0, (new Date(session.startsAt) - Date.now()) / 3600000);
  score += Math.max(0, 5 * (1 - hoursUntilStart / (24 * 14)));
  if (hoursUntilStart <= 24 * 7) reasons.push('Coming up soon');

  return {
    session,
    score: Math.round(score * 100) / 100,
    reasons,
  };
}

function recommendSessions(sessions, user, origin, limit) {
  return sessions
    .map((session) => {
      session._distanceMiles = distanceMiles(session, origin);
      return scoreSession(session, user, origin);
    })
    .sort((a, b) => b.score - a.score || new Date(a.session.startsAt) - new Date(b.session.startsAt))
    .slice(0, limit);
}

function validateRecommendationOptions({ origin, maxDistanceMiles = 50, limit = 10 }) {
  if (!Number.isFinite(maxDistanceMiles) || maxDistanceMiles < 1 || maxDistanceMiles > 250) {
    throw new Error('maxDistanceMiles must be between 1 and 250');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error('limit must be a whole number between 1 and 20');
  }
  if (origin && (
    !Number.isFinite(origin.latitude) || origin.latitude < -90 || origin.latitude > 90
    || !Number.isFinite(origin.longitude) || origin.longitude < -180 || origin.longitude > 180
  )) {
    throw new Error('origin coordinates are out of range');
  }
  return { origin, maxDistanceMiles, limit };
}

function recommendationQuery(user, origin, maxDistanceMiles, now = new Date()) {
  const query = {
    $and: [
      { $or: [
        { visibility: { $in: ['PUBLIC', null] } },
        { visibility: 'FRIENDS', host: { $in: user.friends || [] } },
        { visibility: 'INVITE_ONLY', invitees: user._id },
      ] },
      { host: { $ne: user._id } },
      { participants: { $ne: user._id } },
    ],
    status: 'upcoming',
    startsAt: { $gt: now },
    $expr: { $lt: [{ $size: { $ifNull: ['$participants', []] } }, '$maxParticipants'] },
  };
  if (origin) {
    query.locationPoint = {
      $near: {
        $geometry: { type: 'Point', coordinates: [origin.longitude, origin.latitude] },
        $maxDistance: maxDistanceMiles * MILES_TO_METERS,
      },
    };
  }
  return query;
}

export { recommendSessions, recommendationQuery, validateRecommendationOptions };
