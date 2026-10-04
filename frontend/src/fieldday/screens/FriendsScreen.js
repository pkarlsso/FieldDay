import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, NotificationButton, ScreenHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { useCurrentUser } from '../useCurrentUser';
import { graphql } from '../../api';
import { GET_OR_CREATE_DIRECT_CONVERSATION } from '../../graphql/queries';

export default function FriendsScreen({ navigation }) {
    const openDirectChat = async (friendId) => {
      try {
        const data = await graphql(GET_OR_CREATE_DIRECT_CONVERSATION, { friendId });
        navigation.navigate('ChatDetail', { conversationId: data.getOrCreateDirectConversation.id });
      } catch (error) {
        console.log('Direct chat error:', error.message);
      }
    };

  const user = useCurrentUser();
  const friends = user?.friends || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Friends" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Your friends</Text>
        {friends.length === 0 ? (
          <Card>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              {user ? 'No friends yet. Rate a session to add the people you played with.' : 'Loading your friends…'}
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
