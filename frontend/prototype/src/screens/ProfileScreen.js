import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, HeaderActionRow, IconButton, NotificationButton, ScreenHeader, SportIcon, Stat } from '../components/ui';
import { colors } from '../theme';
import { currentUser, players } from '../data/mockData';

export default function ProfileScreen({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        title="Profile"
        right={
          <HeaderActionRow>
            <NotificationButton onPress={() => navigation.navigate('Notifications')} />
            <IconButton icon="settings-outline" onPress={() => navigation.navigate('Settings')} />
          </HeaderActionRow>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Avatar name={currentUser.name} color={colors.purple} size={86} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 25, fontWeight: '900' }}>{currentUser.name}</Text>
            {currentUser.verifiedStudent ? <Ionicons name="checkmark-circle" size={20} color={colors.blue} /> : null}
          </View>
          <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{currentUser.bio}</Text>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 18, paddingTop: 16 }}>
            <Stat value={currentUser.socialRating.toFixed(1)} label="social rating" color={colors.purple} />
            <Stat value={currentUser.totalRatings} label="ratings" color={colors.green} />
            <Stat value="Verified" label="student" color={colors.blue} />
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Sports preferences</Text>
          <View style={{ gap: 10 }}>
            {currentUser.sports.map((sport) => (
              <View key={sport} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft, borderRadius: 16, padding: 12 }}>
                <SportIcon sport={sport} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: '900' }}>{sport}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>Skill {currentUser.skillLevel}</Text>
                </View>
                <Text style={{ color: colors.purple, fontWeight: '900' }}>Preferred</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Availability</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {currentUser.availability.map((slot) => (
              <View key={slot} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{slot}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Friends</Text>
          {players.slice(0, 4).map((friend, index) => (
            <View key={friend.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
              <Avatar name={friend.name} color={colors.green} size={42} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.ink, fontWeight: '900' }}>{friend.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>{friend.sports.join(', ')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={14} color={colors.gold} />
                <Text style={{ color: colors.gold, fontWeight: '900' }}>{friend.rating}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
