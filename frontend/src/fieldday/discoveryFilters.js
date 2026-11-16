export const DISCOVERY_RADIUS_MIN_MILES = 5;
export const DISCOVERY_RADIUS_MAX_MILES = 100;
export const DISCOVERY_RADIUS_STEP_MILES = 5;
export const DEFAULT_DISCOVERY_RADIUS_MILES = 25;

export function normalizeDiscoveryRadius(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_DISCOVERY_RADIUS_MILES;
  const rounded = Math.round(numeric / DISCOVERY_RADIUS_STEP_MILES) * DISCOVERY_RADIUS_STEP_MILES;
  return Math.min(DISCOVERY_RADIUS_MAX_MILES, Math.max(DISCOVERY_RADIUS_MIN_MILES, rounded));
}

// The API rejects a radius without an origin, so only include it after the
// device or user has supplied valid coordinates.
export function withDiscoveryRadius(filter, origin, radiusMiles) {
  const next = { ...filter, origin: origin || undefined };
  if (origin) next.maxDistanceMiles = normalizeDiscoveryRadius(radiusMiles);
  else delete next.maxDistanceMiles;
  return next;
}

export function isWithinDiscoveryRadius(origin, location, radiusMiles) {
  if (!origin || !Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return true;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(location.latitude - origin.latitude);
  const longitudeDelta = radians(location.longitude - origin.longitude);
  const area = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(location.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  const distanceMiles = earthRadiusMiles * 2 * Math.atan2(Math.sqrt(area), Math.sqrt(1 - area));
  return distanceMiles <= normalizeDiscoveryRadius(radiusMiles);
}
