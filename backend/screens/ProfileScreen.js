import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { graphql, CURRENT_USER_ID } from '../api';

const PURPLE = '#7C7EFF';
const GOLD = '#FFB800';

const QUERY = `
  query GetUser($id: ID!) {
    getUser(id: $id) {
      id name email bio sports skillLevel socialRating totalRatings
      friends { id name socialRating sports }
    }
  }
`;

function StarRating({ rating }) {
  const filled = Math.round(rating);
  return <Text style={styles.stars}>{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</Text>;
}

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await graphql(QUERY, { id: CURRENT_USER_ID });
      setUser(data.getUser);
    } catch (err) {
      console.log('Profile fetch error:', err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchUser);
    return unsubscribe;
  }, [navigation, fetchUser]);

  if (loading && !user) {
    return <View style={styles.center}><ActivityIndicator size="large" color={PURPLE} /></View>;
  }

  if (!user) return <View style={styles.center}><Text>Error loading profile</Text></View>;

  const renderFriend = ({ item }) => (
    <View style={styles.friendRow}>
      <View style={styles.friendAvatar}>
        <Text style={styles.friendInitial}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendSports}>{item.sports?.join(', ')}</Text>
      </View>
      <View style={styles.friendRating}>
        <Text style={styles.friendRatingNum}>
          {item.socialRating > 0 ? item.socialRating.toFixed(1) : 'N/A'}
        </Text>
        {item.socialRating > 0 && <StarRating rating={item.socialRating} />}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <FlatList
        data={user.friends || []}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchUser} />}
        ListHeaderComponent={
          <View>
            <View style={styles.profileCard}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{user.name.charAt(0)}</Text>
              </View>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userBio}>{user.bio}</Text>
              <View style={styles.ratingBox}>
                <Text style={styles.ratingNumber}>
                  {user.socialRating > 0 ? user.socialRating.toFixed(1) : '—'}
                </Text>
                {user.socialRating > 0 && <StarRating rating={user.socialRating} />}
                <Text style={styles.ratingCount}>
                  {user.totalRatings > 0 ? `${user.totalRatings} ratings` : 'No ratings yet'}
                </Text>
              </View>
              <View style={styles.sportsRow}>
                {user.sports?.map((s, i) => (
                  <View key={i} style={styles.sportPill}>
                    <Text style={styles.sportPillText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.friendsTitle}>
              Friends {user.friends?.length > 0 ? `(${user.friends.length})` : ''}
            </Text>
            {(!user.friends || user.friends.length === 0) && (
              <Text style={styles.noFriends}>No friends yet — rate a session and add some!</Text>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  listContent: { padding: 16, paddingBottom: 40 },
  profileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  avatarLarge: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: PURPLE,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarLargeText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  userName: { fontSize: 22, fontWeight: '700', color: '#222' },
  userBio: { fontSize: 14, color: '#666', marginTop: 4 },
  ratingBox: { alignItems: 'center', marginTop: 12 },
  ratingNumber: { fontSize: 32, fontWeight: '700', color: '#222' },
  stars: { fontSize: 18, color: GOLD, marginTop: 2 },
  ratingCount: { fontSize: 12, color: '#888', marginTop: 2 },
  sportsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 },
  sportPill: { backgroundColor: '#E8E8FF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, margin: 3 },
  sportPillText: { fontSize: 12, fontWeight: '600', color: '#3A2D80' },
  friendsTitle: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 12 },
  noFriends: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 20 },
  friendRow: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  friendAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#999',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  friendInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 16, fontWeight: '600', color: '#222' },
  friendSports: { fontSize: 12, color: '#888', marginTop: 2 },
  friendRating: { alignItems: 'center' },
  friendRatingNum: { fontSize: 18, fontWeight: '700', color: '#222' },
});
