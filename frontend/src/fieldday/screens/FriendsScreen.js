import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, NotificationButton, ScreenHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { conversations } from '../data/mockData';
import { useCurrentUser } from '../useCurrentUser';

export default function FriendsScreen({ navigation }) {
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
          <Card key={friend.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={friend.name} uri={friend.profilePicture} color={colors.purple} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{friend.name}</Text>
              {friend.sports?.length ? (
                <Text style={{ color: colors.muted, marginTop: 3 }}>{friend.sports.join(', ')}</Text>
              ) : null}
            </View>
            {friend.socialRating > 0 ? <StatusBadge label={friend.socialRating.toFixed(1)} icon="star" color={colors.gold} /> : null}
          </Card>
        ))}

        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Messages</Text>
        {conversations.map((conversation) => (
          <TouchableOpacity key={conversation.id} activeOpacity={0.88} onPress={() => navigation.navigate('ChatDetail', { conversationId: conversation.id })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={conversation.name} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{conversation.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{conversation.meta}</Text>
              </View>
              {conversation.unread ? (
                <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.card, fontWeight: '900' }}>{conversation.unread}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={19} color={colors.muted} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
