import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, IconButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { notifications } from '../data/mockData';

export default function NotificationsScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Notifications"
        left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 12 }}>
        {notifications.map((item) => (
          <Card key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: item.unread ? colors.purple : colors.line }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: `${item.color}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{item.title}</Text>
                {item.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral }} /> : null}
              </View>
              <Text style={{ color: colors.text, marginTop: 4, lineHeight: 19 }}>{item.detail}</Text>
              <Text style={{ color: colors.muted, marginTop: 5, fontSize: 12, fontWeight: '800' }}>{item.time}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
