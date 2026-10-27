function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function id(value) {
  return String(value);
}

/**
 * Converts FieldDay records into the three custom tables used by Shaped:
 * users, session items, and user-to-session interactions. No email, password,
 * token, or profile image data is exported.
 */
export function buildShapedTables({ users, sessions, ratings }) {
  const userRows = users.map((user) => ({
    id: id(user._id),
    sports: user.sports || [],
    sport_skills: (user.sportSkills || []).map(({ sport, skillLevel }) => ({ sport, skill_level: skillLevel })),
    social_rating: user.socialRating || 0,
    created_at: iso(user.createdAt)
  }));

  const sessionRows = sessions.map((session) => ({
    id: id(session._id),
    sport: session.sport,
    starts_at: iso(session.startsAt),
    location_latitude: session.locationPoint?.coordinates?.[1] ?? null,
    location_longitude: session.locationPoint?.coordinates?.[0] ?? null,
    skill_min: session.skillMin ?? null,
    skill_max: session.skillMax ?? null,
    tags: session.tags || [],
    open_spots: Math.max(0, (session.maxParticipants || 0) - (session.participants?.length || 0)),
    status: session.status,
    created_at: iso(session.createdAt)
  }));

  const registrationRows = sessions.flatMap((session) => (session.participants || []).map((userId) => ({
    user_id: id(userId),
    item_id: id(session._id),
    interaction_type: 'join',
    // FieldDay did not historically persist a membership timestamp. The
    // session creation time is the best available proxy until that field is
    // added to the membership model.
    occurred_at: iso(session.createdAt)
  })));

  const ratingRows = ratings.map((rating) => ({
    user_id: id(rating.rater),
    item_id: id(rating.session),
    interaction_type: 'rating',
    value: rating.value,
    occurred_at: iso(rating.createdAt)
  }));

  return {
    users: userRows,
    sessions: sessionRows,
    interactions: [...registrationRows, ...ratingRows]
  };
}
