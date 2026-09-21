import React, { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, IconButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';

const settings = [
  { id: 'push', label: 'Session reminders', detail: 'Start times, group updates, and rating prompts.' },
  { id: 'friends', label: 'Friend activity', detail: 'Updates when friends join or host sessions.' },
  { id: 'recommendations', label: 'Recommendations', detail: 'Personalized matches from your preferences.' },
];

export default function SettingsScreen({ navigation }) {
  const [enabled, setEnabled] = useState({
    push: true,
    friends: true,
    recommendations: true,
  });

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
              <Text style={{ color: colors.muted, marginTop: 2 }}>Demo controls for what FieldDay would send.</Text>
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
              onValueChange={(value) => setEnabled((current) => ({ ...current, [item.id]: value }))}
              trackColor={{ false: colors.line, true: colors.purpleSoft }}
              thumbColor={enabled[item.id] ? colors.purple : colors.muted}
            />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
