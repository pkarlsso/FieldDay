import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, NotificationButton, PrimaryButton, ScreenHeader, SportIcon, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { recommendationSeed, sessions } from '../data/mockData';

export default function SessionsScreen({ navigation }) {
  const [query, setQuery] = useState(recommendationSeed);
  const recommended = useMemo(() => {
    const semanticQuery = query.toLowerCase();
    const allRecommended = sessions.filter((session) => session.recommended);
    if (!semanticQuery.trim()) return allRecommended;
    if (semanticQuery.includes('competitive') || semanticQuery.includes('intense')) {
      return sessions.filter((session) => ['Competitive', 'Moderate'].includes(session.vibe));
    }
    if (semanticQuery.includes('late') || semanticQuery.includes('night')) {
      return sessions.filter((session) => session.tags.some((tag) => tag.toLowerCase().includes('late')) || session.time.includes('8:'));
    }
    return allRecommended;
  }, [query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="My Sessions" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={21} color={colors.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>Find my kind of session</Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>Describe the vibe, schedule, and intensity.</Text>
            </View>
          </View>
          <TextInput
            multiline
            value={query}
            onChangeText={setQuery}
            placeholder="Try: friendly after work, low intensity, no score keeping..."
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 82,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              borderCurve: 'continuous',
              padding: 12,
              color: colors.ink,
              lineHeight: 20,
              textAlignVertical: 'top',
              backgroundColor: colors.page,
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['after work', 'friendly', 'low intensity', 'no score keeping'].map((chip) => (
              <View key={chip} style={{ backgroundColor: colors.purpleSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Text style={{ color: colors.purpleDark, fontSize: 12, fontWeight: '900' }}>{chip}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Recommended Sessions</Text>
        {recommended.map((session) => (
          <TouchableOpacity key={session.id} activeOpacity={0.88} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SportIcon sport={session.sport} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{session.title}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>{session.date} • {session.time} • {session.distance}</Text>
                </View>
                <StatusBadge label={session.vibe} icon="sparkles" color={colors.purple} />
              </View>
              <Text style={{ color: colors.text, lineHeight: 20 }}>{session.matchReason}</Text>
            </Card>
          </TouchableOpacity>
        ))}

        <Card style={{ backgroundColor: colors.purpleSoft }}>
          <Text style={{ color: colors.purpleDark, fontWeight: '900', fontSize: 13 }}>UP NEXT</Text>
          <Text style={{ color: colors.ink, fontSize: 23, fontWeight: '900', marginTop: 8 }}>{sessions[0].title}</Text>
          <Text style={{ color: colors.text, marginTop: 6 }}>{sessions[0].date} at {sessions[0].time}</Text>
          <View style={{ marginTop: 16 }}>
            <PrimaryButton label="Open Details" icon="open-outline" onPress={() => navigation.navigate('SessionDetails', { sessionId: sessions[0].id })} />
          </View>
        </Card>

        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Upcoming</Text>
        {sessions.slice(0, 3).map((session) => (
          <TouchableOpacity key={session.id} activeOpacity={0.88} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SportIcon sport={session.sport} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{session.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{session.date} • {session.time}</Text>
              </View>
              <Text style={{ color: colors.green, fontWeight: '900' }}>{session.joined}/{session.maxParticipants}</Text>
            </Card>
          </TouchableOpacity>
        ))}

        <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Needs Rating</Text>
        <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('RateSession', { sessionId: sessions[0].id })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.coral }}>
            <SportIcon sport="Pickleball" size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>Pickleball @ Hildegard Park</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>Session complete • 3 players to rate</Text>
            </View>
            <StatusBadge label="Rate" icon="star" color={colors.coral} />
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
