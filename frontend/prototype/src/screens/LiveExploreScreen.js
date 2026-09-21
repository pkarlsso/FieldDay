import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Card, ScreenHeader, SportIcon } from '../components/ui';
import { colors } from '../theme';
import { graphql } from '../../../src/api';

const QUERY = `{ getSessions(status: "upcoming") { id sport startsAt location locationPoint { coordinates } maxParticipants participants { id } } }`;

export default function LiveExploreScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setSessions((await graphql(QUERY)).getSessions || []); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);
  return <View style={{ flex: 1, backgroundColor: colors.page }}>
    <ScreenHeader title="Explore" />
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}
      {!sessions.length && !error ? <ActivityIndicator color={colors.purple} /> : null}
      {sessions.map((session) => <TouchableOpacity key={session.id} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SportIcon sport={session.sport} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{session.sport} at {session.location}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{new Date(session.startsAt).toLocaleString()} • {session.participants.length}/{session.maxParticipants}</Text>
          </View>
        </Card>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}
