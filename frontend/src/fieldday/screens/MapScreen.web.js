import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getDiscoveryOrigin, loadDiscoverySessions } from '../discovery';
import { useDiscoveryRadius } from '../DiscoveryRadiusContext';
import { withDiscoveryRadius } from '../discoveryFilters';
import { playersLabel, skillLabel } from '../sessionInfo';
import logger from '../../logger';

export default function MapScreen() {
  const [sessions, setSessions] = React.useState([]);
  const { radiusMiles } = useDiscoveryRadius();
  React.useEffect(() => {
    if (process.env.EXPO_PUBLIC_LIVE_DATA !== 'true') return undefined;
    let mounted = true;
    getDiscoveryOrigin()
      .then((origin) => loadDiscoverySessions(withDiscoveryRadius({}, origin, radiusMiles)))
      .then((data) => { if (mounted) setSessions(data); })
      .catch((error) => logger.error('Could not load web map sessions:', error));
    return () => { mounted = false; };
  }, [radiusMiles]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map testing is available on iOS.</Text>
      <Text style={styles.detail}>Run the native Expo app to test location permissions and map markers.</Text>
      <Text style={styles.detail}>Current search radius: {radiusMiles} mi.</Text>
      {sessions.map((session) => <Text key={session.id} style={styles.detail}>{session.sport} at {session.location} • {playersLabel(session)} • {skillLabel(session)}: {session.locationPoint.coordinates.join(', ')}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  detail: { marginTop: 10, textAlign: 'center', color: '#666' },
});
