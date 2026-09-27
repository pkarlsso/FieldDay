import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, IconButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { graphql } from '../../api';
import logger from '../../logger';

const NOTIFICATIONS_QUERY = `
  query GetNotifications($limit: Int) {
    getNotifications(limit: $limit) {
      id type category title body readAt createdAt
      target { version screen params }
    }
  }
`;

const MARK_READ_MUTATION = `
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) { id readAt }
  }
`;

const icons = {
  session: ['calendar-outline', '#7C7EFF'],
  friends: ['people-outline', '#FF7A59'],
  ratings: ['star-outline', '#F4B942'],
  chat: ['chatbubble-outline', '#42B883'],
};

function formatTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        const data = await graphql(NOTIFICATIONS_QUERY, { limit: 50 });
        setItems(data.getNotifications);
      } catch (error) {
        logger.error('Could not load notifications', error);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function openNotification(item) {
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      await graphql(MARK_READ_MUTATION, { id: item.id });
    }
    if (item.target?.version !== 1 || !item.target.screen) return;
    let params = {};
    try { params = JSON.parse(item.target.params || '{}'); } catch { return; }
    if (['SessionDetails', 'RateSession', 'SessionComplete', 'ChatDetail', 'Notifications', 'Settings'].includes(item.target.screen)) {
      navigation.navigate(item.target.screen, params);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Notifications"
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 12 }}>
        {loading ? <ActivityIndicator color={colors.purple} /> : null}
        {!loading && items.length === 0 ? <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>You are all caught up.</Text> : null}
        {items.map((item) => {
          const [icon, color] = icons[item.category] || icons.session;
          return (
          <Pressable key={item.id} onPress={() => openNotification(item)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: item.readAt ? colors.line : colors.purple }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: `${color}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{item.title}</Text>
                {!item.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral }} /> : null}
              </View>
              <Text style={{ color: colors.text, marginTop: 4, lineHeight: 19 }}>{item.body}</Text>
              <Text style={{ color: colors.muted, marginTop: 5, fontSize: 12, fontWeight: '800' }}>{formatTime(item.createdAt)}</Text>
            </View>
          </Card>
          </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
