export function validateAddressQuery(query) {
  const normalized = typeof query === 'string' ? query.trim() : '';
  if (normalized.length < 3) return 'Enter at least 3 characters to search for an address or venue.';
  return null;
}

export function firstGeocodedLocation(results) {
  if (!Array.isArray(results)) return null;
  const result = results.find((candidate) => Number.isFinite(candidate?.latitude) && Number.isFinite(candidate?.longitude));
  return result ? { latitude: result.latitude, longitude: result.longitude } : null;
}
