import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { graphql } from '../../api';
import { Avatar, Card, NotificationButton, PrimaryButton, ScreenHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { useCurrentUser } from '../useCurrentUser';
import { GET_OR_CREATE_DIRECT_CONVERSATION } from '../../graphql/queries';

const REQUEST_FIELDS = `
  id status createdAt
  requester { id name profilePicture sports socialRating }
  recipient { id name profilePicture sports socialRating }
`;

const REQUESTS_QUERY = `
  query FriendRequests {
    getMyFriendRequests { ${REQUEST_FIELDS} }
    getFriendCandidates { id name profilePicture sports socialRating }
  }
`;

const LOOKUP_QUERY = `
  query FindUser($id: ID!) {
    findUserById(id: $id) { id name profilePicture sports socialRating }
  }
`;

const SEND_REQUEST = `
  mutation SendFriendRequest($id: ID!) {
    sendFriendRequest(recipientId: $id) { ${REQUEST_FIELDS} }
  }
`;

const ACCEPT_REQUEST = `
  mutation AcceptFriendRequest($id: ID!) {
    acceptFriendRequest(requestId: $id) { id status }
  }
`;

const DECLINE_REQUEST = `
  mutation DeclineFriendRequest($id: ID!) {
    declineFriendRequest(requestId: $id) { id status }
  }
`;

export default function FriendsScreen({ navigation }) {
    const openDirectChat = async (friendId) => {
      try {
        const data = await graphql(GET_OR_CREATE_DIRECT_CONVERSATION, { friendId });
        navigation.navigate('ChatDetail', { conversationId: data.getOrCreateDirectConversation.id });
      } catch (error) {
        Alert.alert('Unable to open chat', error.message);
      }
    };

  const user = useCurrentUser();
  const friends = user?.friends || [];
  const [requests, setRequests] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [lookupId, setLookupId] = useState('');
  const [lookupUser, setLookupUser] = useState(null);
  const [, setLoading] = useState(false);

  const refreshRequests = useCallback(() => {
    setLoading(true);
    graphql(REQUESTS_QUERY)
      .then((data) => {
        setRequests(data.getMyFriendRequests || []);
        setCandidates(data.getFriendCandidates || []);
      })
      .catch((err) => Alert.alert('Could not load friend requests', err.message))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => {
    refreshRequests();
  }, [refreshRequests]));

  const sendRequest = async (recipientId) => {
    try {
      await graphql(SEND_REQUEST, { id: recipientId });
      setLookupUser(null);
      refreshRequests();
    } catch (err) {
      Alert.alert('Could not send request', err.message);
    }
  };

  const copyUserId = async () => {
    if (!user?.id) return;
    await Clipboard.setStringAsync(user.id);
    Alert.alert('User ID copied', 'Share this ID with the person who wants to add you.');
  };

  const lookup = async () => {
    const id = lookupId.trim();
    if (!id) return;
    try {
      const data = await graphql(LOOKUP_QUERY, { id });
      if (!data.findUserById) {
        Alert.alert('User not found', 'Check the user ID and try again.');
        return;
      }
      setLookupUser(data.findUserById);
    } catch (err) {
      Alert.alert('Could not look up user', err.message);
    }
  };

  const updateRequest = async (requestId, mutation) => {
    try {
      await graphql(mutation, { id: requestId });
      refreshRequests();
    } catch (err) {
      Alert.alert('Could not update request', err.message);
    }
  };

  const incoming = requests.filter((request) => request.recipient?.id === user?.id);
  const outgoing = requests.filter((request) => request.requester?.id === user?.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Friends" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Add someone you know</Text>
          <Text style={{ color: colors.muted, marginTop: 5, lineHeight: 19 }}>Use their exact FieldDay user ID.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 10, borderRadius: 14, backgroundColor: colors.purpleSoft }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800' }}>Your user ID</Text>
              <Text selectable style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
                {user?.id || 'Loading...'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Copy your user ID"
              accessibilityRole="button"
              disabled={!user?.id}
              onPress={copyUserId}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', opacity: user?.id ? 1 : 0.5 }}
            >
              <Ionicons name="copy-outline" size={19} color={colors.purple} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TextInput
              value={lookupId}
              onChangeText={setLookupId}
              placeholder="User ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12, color: colors.ink }}
            />
            <PrimaryButton label="Find" icon="search-outline" onPress={lookup} disabled={!lookupId.trim()} />
          </View>
          {lookupUser ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <Avatar name={lookupUser.name} uri={lookupUser.profilePicture} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900' }}>{lookupUser.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{lookupUser.id}</Text>
              </View>
              <PrimaryButton label="Request" icon="person-add-outline" onPress={() => sendRequest(lookupUser.id)} />
            </View>
          ) : null}
        </Card>

        {incoming.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Incoming requests</Text>
            {incoming.map((request) => (
              <Card key={request.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={request.requester.name} uri={request.requester.profilePicture} color={colors.purple} />
                <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '900' }}>{request.requester.name}</Text><Text style={{ color: colors.muted, marginTop: 3 }}>Wants to connect</Text></View>
                <TouchableOpacity onPress={() => updateRequest(request.id, ACCEPT_REQUEST)}><StatusBadge label="Accept" icon="checkmark" color={colors.green} /></TouchableOpacity>
                <TouchableOpacity onPress={() => updateRequest(request.id, DECLINE_REQUEST)}><StatusBadge label="Decline" icon="close" color={colors.coral} /></TouchableOpacity>
              </Card>
            ))}
          </View>
        ) : null}

        {outgoing.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Sent requests</Text>
            {outgoing.map((request) => <Card key={request.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar name={request.recipient.name} uri={request.recipient.profilePicture} color={colors.purple} /><Text style={{ flex: 1, color: colors.ink, fontWeight: '900' }}>{request.recipient.name}</Text><StatusBadge label="Pending" icon="time-outline" color={colors.gold} /></Card>)}
          </View>
        ) : null}

        {candidates.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>People from your sessions</Text>
            {candidates.map((candidate) => <Card key={candidate.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Avatar name={candidate.name} uri={candidate.profilePicture} color={colors.purple} /><Text style={{ flex: 1, color: colors.ink, fontWeight: '900' }}>{candidate.name}</Text><TouchableOpacity onPress={() => sendRequest(candidate.id)}><StatusBadge label="Add" icon="person-add-outline" color={colors.purple} /></TouchableOpacity></Card>)}
          </View>
        ) : null}

        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Your friends</Text>
        {friends.length === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              {user ? 'No friends yet. Send a request to someone you played with.' : 'Loading your friends...'}
            </Text>
          </Card>
        ) : null}
        {friends.map((friend) => (
          <TouchableOpacity key={friend.id} activeOpacity={0.88} onPress={() => openDirectChat(friend.id)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={friend.name} uri={friend.profilePicture} color={colors.purple} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{friend.name}</Text>
              {friend.sports?.length ? (
                <Text style={{ color: colors.muted, marginTop: 3 }}>{friend.sports.join(', ')}</Text>
              ) : null}
            </View>
            {friend.socialRating > 0 ? <StatusBadge label={friend.socialRating.toFixed(1)} icon="star" color={colors.gold} /> : null}
              <Ionicons name="chatbubble-outline" size={20} color={colors.purple} />
            </Card>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </View>
  );
}
