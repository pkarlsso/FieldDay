import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { graphql } from '../../api';

const useGoogleMaps = process.env.EXPO_PUBLIC_MAP_PROVIDER === 'google';
const DEFAULT_REGION = {
  latitude: 40.4237,
  longitude: -86.9212,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
const DEMO_SESSIONS = [
  {
    id: 's1', sport: 'Pickleball', startsAt: '2026-04-12T18:00:00', location: 'Hildegard Park', latitude: 40.4237, longitude: -86.9212,
  },
  {
    id: 's2', sport: 'Soccer', startsAt: '2026-04-12T17:30:00', location: 'Central Field', latitude: 40.431, longitude: -86.915,
  },
];
const LIVE_QUERY = `{ getSessions(status: "upcoming") { id sport startsAt location locationPoint { coordinates } } }`;
const useLiveData = process.env.EXPO_PUBLIC_LIVE_DATA === 'true';

function formatSessionTime(startsAt) {
  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function hasCoordinates(session) {
  return Number.isFinite(session?.locationPoint?.coordinates?.[0]) && Number.isFinite(session?.locationPoint?.coordinates?.[1]);
}

export default function MapScreen({ navigation }) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState(DEMO_SESSIONS);

  useEffect(() => {
    let mounted = true;
    async function locateUser() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const result = await Location.getCurrentPositionAsync({});
        if (mounted) {
          setRegion({ ...DEFAULT_REGION, latitude: result.coords.latitude, longitude: result.coords.longitude });
        }
      }
      if (mounted) setLoading(false);
    }
    locateUser().catch(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!useLiveData) return undefined;
    graphql(LIVE_QUERY).then((data) => setSessions((data.getSessions || []).filter(hasCoordinates).map((session) => ({
      id: session.id,
      sport: session.sport,
      startsAt: session.startsAt,
      location: session.location,
      latitude: session.locationPoint.coordinates[1],
      longitude: session.locationPoint.coordinates[0],
    })))).catch(() => {});
    return undefined;
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        provider={Platform.OS === 'ios' && useGoogleMaps ? PROVIDER_GOOGLE : undefined}
        showsUserLocation
        showsMyLocationButton
      >
        {sessions.map((session) => (
          <Marker
            key={session.id}
            coordinate={session}
            title={session.sport}
            description={`${formatSessionTime(session.startsAt)} · ${session.location}`}
            accessibilityLabel={`${session.sport} session at ${session.location}`}
          >
            <Callout
              tooltip
              onPress={() => navigation?.navigate('SessionDetails', { sessionId: session.id })}
              accessibilityLabel={`Open ${session.sport} session details`}
            >
              <View style={styles.calloutCard}>
                <Text style={styles.calloutSport}>{session.sport}</Text>
                <Text style={styles.calloutDetail}>{formatSessionTime(session.startsAt)}</Text>
                <Text style={styles.calloutDetail}>{session.location}</Text>
                <Text style={styles.calloutAction}>Tap for session details</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      {loading && <View style={styles.status}><ActivityIndicator /><Text>Finding your location</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  status: { position: 'absolute', top: 58, alignSelf: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#fff', padding: 10, borderRadius: 8 },
  calloutCard: { width: 220, backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, elevation: 4 },
  calloutSport: { color: '#1f2937', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  calloutDetail: { color: '#4b5563', fontSize: 14, lineHeight: 20 },
  calloutAction: { color: '#5856d6', fontSize: 13, fontWeight: '600', marginTop: 10 },
});
