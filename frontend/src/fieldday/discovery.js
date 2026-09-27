import * as Location from 'expo-location';
import { graphql } from '../api';

export const DEFAULT_DISCOVERY_FILTER = {
  maxDistanceMiles: 25,
  sports: [],
  minSkillLevel: undefined,
  maxSkillLevel: undefined,
  minOpenSpots: undefined,
  tags: [],
};

const DISCOVERY_QUERY = `
  query Discovery($status: String, $filter: SessionDiscoveryFilterInput) {
    getSessions(status: $status, filter: $filter) {
      id sport startsAt location skillRange tags distanceMiles
      locationPoint { coordinates }
      maxParticipants participants { id }
    }
  }
`;

export function cleanDiscoveryFilter(filter) {
  return Object.fromEntries(Object.entries(filter).filter(([, value]) => {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }));
}

export async function loadDiscoverySessions(filter) {
  const data = await graphql(DISCOVERY_QUERY, {
    status: 'upcoming',
    filter: cleanDiscoveryFilter(filter),
  });
  return data.getSessions || [];
}

export async function getDiscoveryOrigin() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;
  const result = await Location.getCurrentPositionAsync({});
  return { latitude: result.coords.latitude, longitude: result.coords.longitude };
}