import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { graphql } from '../../../src/api';

const useGoogleMaps = process.env.EXPO_PUBLIC_MAP_PROVIDER === 'google';
const DEFAULT_REGION = {
  latitude: 40.4237,
  longitude: -86.9212,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
const DEMO_SESSIONS = [
  { id: 's1', title: 'Pickleball at Hildegard Park', latitude: 40.4237, longitude: -86.9212 },
  { id: 's2', title: 'Soccer at Central Field', latitude: 40.431, longitude: -86.915 },
];
const LIVE_QUERY = `{ getSessions(status: "upcoming") { id sport location locationPoint { coordinates } } }`;
const useLiveData = process.env.EXPO_PUBLIC_LIVE_DATA === 'true';

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
    graphql(LIVE_QUERY).then((data) => setSessions((data.getSessions || []).map((session) => ({
      id: session.id,
      title: `${session.sport} at ${session.location}`,
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
          <Marker key={session.id} coordinate={session}>
            <Callout onPress={() => navigation?.navigate('SessionDetails', { sessionId: session.id })}>
              <Text>{session.title}{useLiveData ? '\nTap to view and join' : ''}</Text>
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
});
