import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, IconButton, NotificationButton, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { sessions } from '../data/mockData';

export default function SessionCompleteScreen({ route, navigation }) {
  const session = route.params?.session || sessions.find((item) => item.id === route.params?.sessionId) || sessions[0];
  const { avgRatingGiven = 4.2, friendRequestsSent = 2, playersRated = 3 } = route.params || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Ratings sent"
        left={<IconButton icon="close" onPress={() => navigation.navigate('MainTabs', { screen: 'Sessions' })} />}
        right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />}
      />
      <View style={{ padding: 18, gap: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={54} color={colors.green} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 18 }}>Ratings sent!</Text>
          <Text style={{ color: colors.text, marginTop: 8, textAlign: 'center' }}>Thanks for helping keep FieldDay welcoming and reliable.</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>{session.title}</Text>
          <View style={{ alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 22, paddingTop: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="star" size={18} color={colors.gold} />
              <Text style={{ color: colors.text }}>Average rating submitted: <Text style={{ fontWeight: '900' }}>{avgRatingGiven}</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="people-outline" size={18} color={colors.purple} />
              <Text style={{ color: colors.text }}>Players rated: <Text style={{ fontWeight: '900' }}>{playersRated}</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="person-add-outline" size={18} color={colors.green} />
              <Text style={{ color: colors.text }}>Friend requests sent: <Text style={{ fontWeight: '900' }}>{friendRequestsSent}</Text></Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18, marginBottom: 12 }}>Recap</Text>
          {session.players.map((player, index) => (
            <View key={player.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
              <Avatar name={player.name} color={colors.purple} size={38} />
              <Text style={{ flex: 1, marginLeft: 10, color: colors.ink, fontWeight: '800' }}>{player.name}</Text>
              <Text style={{ color: colors.green, fontWeight: '900' }}>{index === 2 ? '3/5' : index === 1 ? '5/5' : '4/5'}</Text>
            </View>
          ))}
        </Card>

        <View style={{ gap: 10 }}>
          <PrimaryButton label="Share Session" icon="share-outline" variant="secondary" onPress={() => {}} />
          <PrimaryButton label="Done" icon="checkmark-circle-outline" onPress={() => navigation.navigate('MainTabs', { screen: 'Sessions' })} />
        </View>
      </View>
    </View>
  );
}
