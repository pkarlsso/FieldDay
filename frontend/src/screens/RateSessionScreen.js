import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { graphql, CURRENT_USER_ID } from '../api';

const PURPLE = '#7C7EFF';
const GREEN = '#2DB55D';

const MUTATION = `
  mutation SubmitRatings($sessionId: ID!, $raterId: ID!, $ratings: [RatingInput!]!) {
    submitRatings(sessionId: $sessionId, raterId: $raterId, ratings: $ratings) {
      success message avgRatingGiven friendRequestsSent
      updatedUsers { id name socialRating }
    }
  }
`;

function RatingPicker({ value, onValueChange }) {
  return (
    <View style={styles.ratingContainer}>
      <Text style={styles.ratingValue}>{value}</Text>
      <View style={styles.ratingTrack}>
        <View style={[styles.ratingFill, { width: `${(value / 5) * 100}%` }]} />
      </View>
      <View style={styles.ratingButtons}>
        {[1, 2, 3, 4, 5].map((num) => (
          <TouchableOpacity
            key={num}
            style={[styles.ratingDot, value === num && styles.ratingDotActive]}
            onPress={() => onValueChange(num)}
          >
            <Text style={[styles.ratingDotText, value === num && styles.ratingDotTextActive]}>
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function RateSessionScreen({ route, navigation }) {
  const { session } = route.params;
  const otherParticipants = session.participants.filter(p => p.id !== CURRENT_USER_ID);

  const [ratings, setRatings] = useState(
    otherParticipants.reduce((acc, p) => ({ ...acc, [p.id]: 3 }), {})
  );
  const [friendFlags, setFriendFlags] = useState(
    otherParticipants.reduce((acc, p) => ({ ...acc, [p.id]: false }), {})
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const ratingsInput = otherParticipants.map(p => ({
      userId: p.id,
      rating: ratings[p.id],
      addFriend: friendFlags[p.id],
    }));

    try {
      const data = await graphql(MUTATION, {
        sessionId: session.id,
        raterId: CURRENT_USER_ID,
        ratings: ratingsInput,
      });

      const result = data.submitRatings;
      navigation.navigate('SessionComplete', {
        avgRatingGiven: result.avgRatingGiven,
        friendRequestsSent: result.friendRequestsSent,
        playersRated: otherParticipants.length,
      });
    } catch (err) {
      Alert.alert('Error', err.message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rate Session</Text>
      </View>
      <View style={styles.contextBanner}>
        <Text style={styles.contextText}>
          {session.sport}  |  {session.date}  |  {session.location}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {otherParticipants.map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerName}>{player.name}</Text>
              <TouchableOpacity
                style={[styles.friendCheck, friendFlags[player.id] && styles.friendCheckActive]}
                onPress={() => setFriendFlags(f => ({ ...f, [player.id]: !f[player.id] }))}
              >
                {friendFlags[player.id] && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.friendLabel}>Add Friend</Text>
            </View>
            <RatingPicker
              value={ratings[player.id]}
              onValueChange={(val) => setRatings(r => ({ ...r, [player.id]: val }))}
            />
          </View>
        ))}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Ratings</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  contextBanner: { backgroundColor: '#E8E8FF', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10 },
  contextText: { fontSize: 13, fontWeight: '600', color: '#3A2D80', textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  playerRow: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  playerName: { fontSize: 20, fontWeight: '700', color: '#222', flex: 1 },
  friendCheck: {
    width: 22, height: 22, borderWidth: 2, borderColor: '#999',
    borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  friendCheckActive: { backgroundColor: GREEN, borderColor: GREEN },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  friendLabel: { fontSize: 12, color: '#666' },
  ratingContainer: { alignItems: 'center' },
  ratingValue: { fontSize: 24, fontWeight: '700', color: PURPLE, marginBottom: 8 },
  ratingTrack: { width: '100%', height: 6, backgroundColor: '#DDD', borderRadius: 3, marginBottom: 12 },
  ratingFill: { height: 6, backgroundColor: PURPLE, borderRadius: 3 },
  ratingButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  ratingDot: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEE',
    justifyContent: 'center', alignItems: 'center',
  },
  ratingDotActive: { backgroundColor: PURPLE },
  ratingDotText: { fontSize: 18, fontWeight: '600', color: '#888' },
  ratingDotTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: GREEN, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
