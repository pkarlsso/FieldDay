export function buildExploreRequest(filter, origin) {
  const next = { ...filter };
  if (origin) next.origin = origin;
  else {
    delete next.origin;
    // The backend requires an origin whenever a radius is supplied.
    delete next.maxDistanceMiles;
  }
  return next;
}

export function exploreFeedbackState({ loading, error, sessions }) {
  if (loading) return 'loading';
  if (error) return 'error';
  if (!sessions.length) return 'empty';
  return 'results';
}
