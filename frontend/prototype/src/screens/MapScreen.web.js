import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { graphql } from '../../../src/api';

const QUERY = `{ getSessions(status: "upcoming") { id sport location locationPoint { coordinates } } }`;

export default function MapScreen() {
  const [sessions, setSessions] = React.useState([]);
  React.useEffect(() => {
    if (process.env.EXPO_PUBLIC_LIVE_DATA === 'true') graphql(QUERY).then((data) => setSessions(data.getSessions || [])).catch(() => {});
  }, []);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map testing is available on iOS.</Text>
      <Text style={styles.detail}>Run the native Expo app to test location permissions and map markers.</Text>
      {sessions.map((session) => <Text key={session.id} style={styles.detail}>{session.sport} at {session.location}: {session.locationPoint.coordinates.join(', ')}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  detail: { marginTop: 10, textAlign: 'center', color: '#666' },
});
