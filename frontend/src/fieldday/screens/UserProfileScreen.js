import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Card, IconButton, PrimaryButton, ScreenHeader, SportIcon, Stat, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { useCurrentUser } from '../useCurrentUser';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';
import { GET_OR_CREATE_DIRECT_CONVERSATION } from '../../graphql/queries';

// Another player's public profile (#364), opened by tapping their name in a
// session roster, a chat or the Friends tab. Only public fields are fetched.
const QUERY = `
  query PublicProfile($id: ID!) {
    findUserById(id: $id) {
      id name bio hometown profilePicture socialRating totalRatings
      sportSkills { sport skillLevel }
    }
  }
`;

const SEND_REQUEST = `
  mutation SendFriendRequest($id: ID!) {
    sendFriendRequest(recipientId: $id) { id status }
  }
`;

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const me = useCurrentUser();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    graphql(QUERY, { id: userId })
      .then((data) => {
        if (!active) return;
        if (data.findUserById) setProfile(data.findUserById);
        else setError('This player could not be found.');
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [userId]));

  const isFriend = Boolean(me?.friends?.some((friend) => friend.id === userId));
  const isMe = userId === CURRENT_USER_ID;

  async function message() {
    setBusy(true);
    try {
      const data = await graphql(GET_OR_CREATE_DIRECT_CONVERSATION, { friendId: userId });
      navigation.navigate('ChatDetail', { conversationId: data.getOrCreateDirectConversation.id });
    } catch (err) {
      Alert.alert('Unable to open chat', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addFriend() {
    setBusy(true);
    try {
      await graphql(SEND_REQUEST, { id: userId });
      setRequestSent(true);
    } catch (err) {
      Alert.alert('Could not send request', err.message);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <ScreenHeader title="Player" left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />} />
  );

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        {header}
        {error
          ? <Text style={{ color: colors.coral, padding: 18 }}>{error}</Text>
          : <ActivityIndicator size="large" color={colors.purple} style={{ marginTop: 40 }} />}
      </View>
    );
  }

  const sportSkills = profile.sportSkills || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Avatar name={profile.name} uri={profile.profilePicture} color={colors.purple} size={86} />
          <Text style={{ color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 14 }}>{profile.name}</Text>
          {profile.hometown ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: '700' }}>{profile.hometown}</Text>
            </View>
          ) : null}
          {profile.bio ? (
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{profile.bio}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 18, paddingTop: 16 }}>
            <Stat value={profile.socialRating > 0 ? profile.socialRating.toFixed(1) : '—'} label="social rating" color={colors.purple} />
            <Stat value={profile.totalRatings || 0} label="ratings" color={colors.green} />
            <Stat value={sportSkills.length} label="sports" color={colors.blue} />
          </View>
          {isMe ? null : (
            <View style={{ alignSelf: 'stretch', marginTop: 18, gap: 10 }}>
              {isFriend ? (
                <PrimaryButton label="Message" icon="chatbubble-outline" disabled={busy} onPress={message} />
              ) : requestSent ? (
                <View style={{ alignItems: 'center' }}>
                  <StatusBadge label="Friend request sent" icon="time-outline" color={colors.gold} />
                </View>
              ) : (
                <PrimaryButton label="Add friend" icon="person-add-outline" variant="secondary" disabled={busy || !me} onPress={addFriend} />
              )}
            </View>
          )}
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Sports</Text>
          {sportSkills.length === 0 ? (
            <Text style={{ color: colors.muted, lineHeight: 20 }}>No sports listed yet.</Text>
          ) : null}
          <View style={{ gap: 10 }}>
            {sportSkills.map(({ sport, skillLevel }) => (
              <View key={sport} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft, borderRadius: 16, padding: 12 }}>
                <SportIcon sport={sport} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: '900' }}>{sport}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>Skill level {Math.round(skillLevel)} of 5</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
