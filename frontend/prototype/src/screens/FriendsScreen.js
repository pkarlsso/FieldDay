import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, NotificationButton, ScreenHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { conversations, friendActivities, players } from '../data/mockData';

export default function FriendsScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Friends" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Friend activity</Text>
        {friendActivities.map((activity) => {
          const friend = players.find((item) => item.id === activity.playerId);
          return (
            <Card key={activity.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={activity.name} color={activity.color} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 15 }}>{activity.name}</Text>
                <Text style={{ color: colors.text, marginTop: 3, lineHeight: 19 }}>{activity.status}</Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>{activity.detail}</Text>
              </View>
              {friend ? <StatusBadge label={friend.rating.toFixed(1)} icon="star" color={colors.gold} /> : null}
            </Card>
          );
        })}

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
