import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, IconButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { graphql } from '../../api';
import logger from '../../logger';

const settings = [
  { id: 'session', label: 'Session updates', detail: 'Start times, group updates, and session changes.' },
  { id: 'friends', label: 'Friend activity', detail: 'Friend requests and updates from friends.' },
  { id: 'ratings', label: 'Ratings', detail: 'Rating prompts after completed sessions.' },
  { id: 'chat', label: 'Chat messages', detail: 'Messages and conversations in your sessions.' },
];

const PREFERENCES_QUERY = `query GetNotificationPreferences { getNotificationPreferences { session friends ratings chat } }`;
const UPDATE_PREFERENCES = `mutation UpdateNotificationPreferences($session: Boolean, $friends: Boolean, $ratings: Boolean, $chat: Boolean) { updateNotificationPreferences(session: $session, friends: $friends, ratings: $ratings, chat: $chat) { session friends ratings chat } }`;

export default function SettingsScreen({ navigation }) {
  const [enabled, setEnabled] = useState({ session: true, friends: true, ratings: true, chat: true });

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        const data = await graphql(PREFERENCES_QUERY);
        setEnabled(data.getNotificationPreferences);
      } catch (error) {
        logger.error('Could not load notification preferences', error);
      }
    });
  }, []);

  async function togglePreference(id, value) {
    const next = { ...enabled, [id]: value };
    setEnabled(next);
    try {
      await graphql(UPDATE_PREFERENCES, next);
    } catch (error) {
      setEnabled(enabled);
      logger.error('Could not update notification preferences', error);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Settings"
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications-outline" size={22} color={colors.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Notification preferences</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>Choose which categories can send push alerts.</Text>
            </View>
          </View>
        </Card>

        {settings.map((item) => (
          <Card key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{item.label}</Text>
              <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 19 }}>{item.detail}</Text>
            </View>
            <Switch
              value={enabled[item.id]}
              onValueChange={(value) => togglePreference(item.id, value)}
              trackColor={{ false: colors.line, true: colors.purpleSoft }}
              thumbColor={enabled[item.id] ? colors.purple : colors.muted}
            />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
