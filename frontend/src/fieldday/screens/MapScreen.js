import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { graphql } from '../../api';
import { colors, getSportConfig } from '../theme';

const useGoogleMaps = process.env.EXPO_PUBLIC_MAP_PROVIDER === 'google';
const DEFAULT_REGION = {
  latitude: 40.4237,
  longitude: -86.9212,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
const DEMO_SESSIONS = [
  { id: 's1', sport: 'Pickleball', title: 'Pickleball at Hildegard Park', latitude: 40.4237, longitude: -86.9212 },
  { id: 's2', sport: 'Soccer', title: 'Soccer at Central Field', latitude: 40.431, longitude: -86.915 },
  { id: 's3', sport: 'Basketball', title: 'Basketball at Co-Rec Courts', latitude: 40.428, longitude: -86.921 },
  { id: 's4', sport: 'Tennis', title: 'Tennis at Riverside Courts', latitude: 40.419, longitude: -86.907 },
  { id: 's5', sport: 'Volleyball', title: 'Volleyball at Third Street Courts', latitude: 40.426, longitude: -86.93 },
  { id: 's6', sport: 'Running', title: 'Running at Discovery Park Loop', latitude: 40.438, longitude: -86.912 },
  { id: 's7', sport: 'Baseball', title: 'Baseball at Slater Hill', latitude: 40.416, longitude: -86.923 },
];
const LIVE_QUERY = `{ getSessions(status: "upcoming") { id sport location locationPoint { coordinates } } }`;
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

export default function MapScreen({ navigation }) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState(DEMO_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

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
      sport: session.sport,
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
          <Marker
            key={session.id}
            coordinate={session}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={`${session.sport || 'Sport'} session at ${session.title}`}
            onPress={() => setSelectedSessionId(session.id)}
          >
            <SessionMarkerIcon sport={session.sport} selected={session.id === selectedSessionId} />
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
});
