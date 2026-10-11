import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getDiscoveryOrigin, loadDiscoverySessions } from '../discovery';
import { formatSessionTime, playersLabel, skillLabel } from '../sessionInfo';
import { colors, getSportConfig } from '../theme';
import logger from '../../logger';

const useGoogleMaps = process.env.EXPO_PUBLIC_MAP_PROVIDER === 'google';
const DEFAULT_REGION = {
  latitude: 40.4237,
  longitude: -86.9212,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
const DEMO_SESSIONS = [
  { id: 's1', sport: 'Pickleball', startsAt: '2026-04-12T18:00:00', location: 'Hildegard Park', latitude: 40.4237, longitude: -86.9212 },
  { id: 's2', sport: 'Soccer', startsAt: '2026-04-12T17:30:00', location: 'Central Field', latitude: 40.431, longitude: -86.915 },
  { id: 's3', sport: 'Basketball', startsAt: '2026-04-13T19:00:00', location: 'Co-Rec Courts', latitude: 40.428, longitude: -86.921 },
  { id: 's4', sport: 'Tennis', startsAt: '2026-04-18T10:00:00', location: 'Riverside Courts', latitude: 40.419, longitude: -86.907 },
  { id: 's5', sport: 'Volleyball', startsAt: '2026-04-12T20:15:00', location: 'Third Street Courts', latitude: 40.426, longitude: -86.93 },
  { id: 's6', sport: 'Running', startsAt: '2026-04-16T18:30:00', location: 'Discovery Park Loop', latitude: 40.438, longitude: -86.912 },
  { id: 's7', sport: 'Baseball', startsAt: '2026-04-17T17:45:00', location: 'Slater Hill', latitude: 40.416, longitude: -86.923 },
];
const useLiveData = process.env.EXPO_PUBLIC_LIVE_DATA === 'true';

function SessionMarkerIcon({ sport, selected }) {
  const config = getSportConfig(sport);
  return (
    <View style={[styles.markerOuter, selected && { borderColor: config.color, borderWidth: 3 }]}>
      <View style={[styles.markerInner, { backgroundColor: config.color }]}>
        <MaterialCommunityIcons name={config.icon} size={20} color={colors.card} />
      </View>
    </View>
  );
}

function hasCoordinates(session) {
  return Number.isFinite(session?.locationPoint?.coordinates?.[0]) && Number.isFinite(session?.locationPoint?.coordinates?.[1]);
}

export default function MapScreen({ navigation }) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState(DEMO_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function locateUser() {
      const location = await getDiscoveryOrigin();
      if (location) {
        if (mounted) {
          setOrigin(location);
          setRegion({ ...DEFAULT_REGION, latitude: location.latitude, longitude: location.longitude });
        }
      }
      if (mounted) setLoading(false);
    }
    locateUser().catch((error) => {
      logger.warn('Could not determine map location:', error);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!useLiveData) return undefined;
    loadDiscoverySessions({ origin }).then((data) => setSessions(data.filter(hasCoordinates).map((session) => ({
      id: session.id,
      sport: session.sport,
      startsAt: session.startsAt,
      location: session.location,
      skillLevel: session.skillLevel,
      skillRange: session.skillRange,
      maxParticipants: session.maxParticipants,
      participants: session.participants,
      latitude: session.locationPoint.coordinates[1],
      longitude: session.locationPoint.coordinates[0],
    })))).catch((error) => logger.error('Could not load map sessions:', error));
    return undefined;
  }, [origin]);

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
            anchor={{ x: 0.5, y: 0.5 }}
            title={session.sport}
            description={`${formatSessionTime(session.startsAt)} · ${session.location}`}
            accessibilityLabel={`${session.sport} session at ${session.location}`}
            onPress={() => setSelectedSessionId(session.id)}
          >
            <SessionMarkerIcon sport={session.sport} selected={session.id === selectedSessionId} />
            <Callout
              tooltip
              onPress={() => navigation?.navigate('SessionDetails', { sessionId: session.id })}
              accessibilityLabel={`Open ${session.sport} session details`}
            >
              <View style={styles.calloutCard}>
                <Text style={styles.calloutSport}>{session.sport}</Text>
                <Text style={styles.calloutDetail}>{formatSessionTime(session.startsAt)}</Text>
                <Text style={styles.calloutDetail}>{session.location}</Text>
                {session.maxParticipants ? (
                  <Text style={styles.calloutDetail}>{playersLabel(session)} • {skillLabel(session)}</Text>
                ) : null}
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
  markerOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  markerInner: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  calloutCard: { width: 220, backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, elevation: 4 },
  calloutSport: { color: '#1f2937', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  calloutDetail: { color: '#4b5563', fontSize: 14, lineHeight: 20 },
  calloutAction: { color: '#5856d6', fontSize: 13, fontWeight: '600', marginTop: 10 },
});
