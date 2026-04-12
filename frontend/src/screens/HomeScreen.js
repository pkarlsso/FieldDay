import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { graphql, CURRENT_USER_ID } from '../api';

const PURPLE = '#7C7EFF';

const QUERY = `
  query GetCompletedSessions($userId: ID!) {
    getCompletedSessions(userId: $userId) {
      id sport date time location skillRange rated
      participants { id name skillLevel socialRating }
      host { id name }
    }
  }
`;

export default function HomeScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await graphql(QUERY, { userId: CURRENT_USER_ID });
      setSessions(data.getCompletedSessions || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchSessions);
    return unsubscribe;
  }, [navigation, fetchSessions]);

  if (loading && sessions.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color={PURPLE} /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error loading sessions</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchSessions}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderSession = ({ item }) => (
    <TouchableOpacity
      style={[styles.sessionCard, item.rated && styles.sessionCardRated]}
      onPress={() => navigation.navigate('RateSession', { session: item })}
      disabled={item.rated}
    >
      <View style={styles.sessionHeader}>
        <Text style={styles.sportBadge}>{item.sport}</Text>
        <Text style={[styles.sessionStatus, item.rated && { color: '#888' }]}>
          {item.rated ? '✓ Rated' : 'Rate Now'}
        </Text>
      </View>
      <Text style={styles.sessionLocation}>{item.location}</Text>
      <Text style={styles.sessionDate}>{item.date} at {item.time}</Text>
      <Text style={styles.sessionPlayers}>
        {item.participants.length} players · Skill {item.skillRange}
      </Text>
      {!item.rated && (
        <View style={styles.ratePrompt}>
          <Text style={styles.ratePromptText}>Tap to rate participants →</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
        <Text style={styles.headerSubtitle}>Past Sessions</Text>
      </View>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSessions} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No sessions to rate!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  list: { padding: 16 },
  sessionCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  sessionCardRated: { opacity: 0.5 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sportBadge: {
    backgroundColor: PURPLE, color: '#fff', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, fontSize: 13, fontWeight: '600', overflow: 'hidden',
  },
  sessionStatus: { fontSize: 13, fontWeight: '600', color: '#2DB55D' },
  sessionLocation: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 4 },
  sessionDate: { fontSize: 14, color: '#666', marginBottom: 4 },
  sessionPlayers: { fontSize: 13, color: '#888' },
  ratePrompt: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  ratePromptText: { color: PURPLE, fontWeight: '600', fontSize: 14 },
  errorText: { fontSize: 18, fontWeight: '600', color: '#c00' },
  errorDetail: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center' },
  retryBtn: { marginTop: 16, backgroundColor: PURPLE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 40 },
});
