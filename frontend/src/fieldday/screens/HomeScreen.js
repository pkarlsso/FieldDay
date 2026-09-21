import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, HeaderActionRow, NotificationButton, ScreenHeader, SportIcon, Stat, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { currentUser, feed, sessions } from '../data/mockData';

export default function HomeScreen({ navigation }) {
  const nextSession = sessions[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        eyebrow="FIELD DAY"
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Your nearby games, trust signals, and upcoming sessions in one place."
        right={
          <HeaderActionRow>
            <NotificationButton onPress={() => navigation.navigate('Notifications')} />
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.purple,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.card, fontWeight: '900' }}>{currentUser.initials}</Text>
            </TouchableOpacity>
          </HeaderActionRow>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card style={{ backgroundColor: colors.purple }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <SportIcon sport={nextSession.sport} size={58} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.card, fontSize: 13, fontWeight: '800', opacity: 0.9 }}>NEXT SESSION</Text>
              <Text style={{ color: colors.card, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{nextSession.title}</Text>
              <Text style={{ color: colors.card, fontSize: 14, marginTop: 6, opacity: 0.9 }}>
                {nextSession.date} at {nextSession.time} • {nextSession.distance}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 12 }}>
            <Stat value={currentUser.socialRating.toFixed(1)} label="rating" color={colors.card} labelColor={colors.card} />
            <Stat value="3" label="sports" color={colors.card} labelColor={colors.card} />
            <Stat value="2" label="alerts" color={colors.card} labelColor={colors.card} />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => navigation.navigate('Explore')}
            style={{ flex: 1, backgroundColor: colors.green, borderRadius: 18, borderCurve: 'continuous', padding: 16 }}
          >
            <MaterialCommunityIcons name="map-search-outline" size={30} color={colors.card} />
            <Text style={{ color: colors.card, fontWeight: '900', fontSize: 16, marginTop: 10 }}>Find a game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => navigation.navigate('Sessions')}
            style={{ flex: 1, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous', padding: 16 }}
          >
            <MaterialCommunityIcons name="calendar-check-outline" size={30} color={colors.purple} />
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16, marginTop: 10 }}>My sessions</Text>
          </TouchableOpacity>
        </View>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Today at a glance</Text>
          {[
            { icon: 'people-outline', label: 'Group chat active', detail: 'Josh offered to bring extra paddles.' },
            { icon: 'location-outline', label: 'Closest game', detail: 'Pickleball is 0.4 mi away.' },
            { icon: 'star-outline', label: 'Rating pending', detail: 'One completed session is ready to rate.' },
          ].map((item, index) => (
            <View key={item.label} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
              <Ionicons name={item.icon} size={19} color={colors.purple} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '900' }}>{item.label}</Text>
                <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 19 }}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Activity</Text>
          {feed.map((item) => (
            <View key={item.id} style={{ paddingVertical: 10, borderBottomWidth: item.id === feed[feed.length - 1].id ? 0 : 1, borderBottomColor: colors.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.ink, fontWeight: '900' }}>{item.label}</Text>
                {item.id === 'f1' ? <StatusBadge label="New" icon="sparkles" color={colors.purple} /> : null}
              </View>
              <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 19 }}>{item.detail}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
