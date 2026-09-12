import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, IconButton, NotificationButton, PrimaryButton, ScreenHeader, SportIcon, Stat, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { sessions } from '../data/mockData';

export default function SessionDetailsScreen({ route, navigation }) {
  const session = sessions.find((item) => item.id === route.params?.sessionId) || sessions[0];
  const [joined, setJoined] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title={`${session.sport} Session`}
        left={<IconButton icon="chevron-back" color={colors.ink} onPress={() => navigation.goBack()} />}
        right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />}
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <SportIcon sport={session.sport} size={68} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{session.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
                <Ionicons name="calendar-outline" size={15} color={colors.muted} />
                <Text style={{ color: colors.muted }}>{session.date} • {session.time}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="location-outline" size={15} color={colors.muted} />
                <Text style={{ color: colors.muted }}>{session.location} • {session.distance}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }}>
            <Stat value={`${session.joined}/${session.maxParticipants}`} label="joined" color={colors.purple} />
            <Stat value={session.skillRange} label="skill" color={colors.green} />
            <Stat value={session.host} label="host" color={colors.coral} />
          </View>
        </Card>

        {joined ? (
          <Card style={{ alignItems: 'center', gap: 12, backgroundColor: colors.greenSoft }}>
            <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={42} color={colors.card} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900' }}>You're in</Text>
            <Text style={{ color: colors.text, textAlign: 'center', lineHeight: 20 }}>Added to your schedule. The group chat is ready for coordination.</Text>
            <View style={{ width: '100%', gap: 10 }}>
              <PrimaryButton label="Open Group Chat" icon="chatbubble-ellipses-outline" onPress={() => navigation.navigate('MainTabs', { screen: 'Friends' })} />
              <PrimaryButton label="View My Sessions" icon="calendar-outline" variant="secondary" onPress={() => navigation.navigate('MainTabs', { screen: 'Sessions' })} />
              <PrimaryButton label="Leave Session" icon="exit-outline" variant="destructive" onPress={() => setJoined(false)} />
            </View>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            <PrimaryButton label="Join Session" icon="add-circle-outline" onPress={() => setJoined(true)} />
            <PrimaryButton label="Get Directions" icon="navigate-outline" variant="secondary" onPress={() => {}} />
          </View>
        )}

        <Card>
          <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '900', marginBottom: 10 }}>Session notes</Text>
          <Text style={{ color: colors.text, lineHeight: 21 }}>{session.note}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {session.tags.map((tag) => (
              <View key={tag} style={{ backgroundColor: colors.purpleSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 }}>
                <Text style={{ color: colors.purpleDark, fontWeight: '800', fontSize: 12 }}>{tag}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '900', marginBottom: 12 }}>Players</Text>
          {session.players.map((player) => (
            <View key={player.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Avatar name={player.name} color={colors.purple} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.ink, fontWeight: '900' }}>{player.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>Skill {player.skill} • Rating {player.rating}</Text>
              </View>
              <StatusBadge
                label={player.present ? 'Present' : 'Pending'}
                icon={player.present ? 'checkmark-circle' : 'time-outline'}
                color={player.present ? colors.green : colors.coral}
              />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
