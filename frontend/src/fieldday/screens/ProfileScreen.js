import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, HeaderActionRow, IconButton, NotificationButton, PrimaryButton, ScreenHeader, SportIcon, Stat } from '../components/ui';
import { colors } from '../theme';
import { useCurrentUser } from '../useCurrentUser';
import { endSession } from '../../session';

export default function ProfileScreen({ navigation }) {
  const user = useCurrentUser();

  const handleLogout = async () => {
    await endSession();
    // Reset the parent stack so the back button can't return to a signed-in screen.
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const header = (
    <ScreenHeader
      title="Profile"
      right={
        <HeaderActionRow>
          <NotificationButton onPress={() => navigation.navigate('Notifications')} />
          <IconButton icon="settings-outline" onPress={() => navigation.navigate('Settings')} />
        </HeaderActionRow>
      }
    />
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        {header}
        <ActivityIndicator size="large" color={colors.purple} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const sportSkills = user.sportSkills || [];
  const friends = user.friends || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}>
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Avatar name={user.name} uri={user.profilePicture} color={colors.purple} size={86} />
          <Text style={{ color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 14 }}>{user.name}</Text>
          {user.hometown ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: '700' }}>{user.hometown}</Text>
            </View>
          ) : null}
          {user.bio ? (
            <Text style={{ color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{user.bio}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: 1, borderTopColor: colors.line, marginTop: 18, paddingTop: 16 }}>
            <Stat value={user.socialRating > 0 ? user.socialRating.toFixed(1) : '—'} label="social rating" color={colors.purple} />
            <Stat value={user.totalRatings || 0} label="ratings" color={colors.green} />
            <Stat value={sportSkills.length} label="sports" color={colors.blue} />
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
            <PrimaryButton label="Edit Profile" icon="create-outline" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Sports preferences</Text>
          {sportSkills.length === 0 ? (
            <Text style={{ color: colors.muted, lineHeight: 20 }}>No sports yet. Add some from Edit Profile.</Text>
          ) : null}
          <View style={{ gap: 10 }}>
            {sportSkills.map(({ sport, skillLevel }) => (
              <View key={sport} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purpleSoft, borderRadius: 16, padding: 12 }}>
                <SportIcon sport={sport} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontWeight: '900' }}>{sport}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>Skill level {Math.round(skillLevel)} of 5</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>
            Friends{friends.length > 0 ? ` (${friends.length})` : ''}
          </Text>
          {friends.length === 0 ? (
            <Text style={{ color: colors.muted, lineHeight: 20 }}>No friends yet. Rate a session to add the people you played with.</Text>
          ) : null}
          {friends.map((friend, index) => (
            <View key={friend.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
              <Avatar name={friend.name} uri={friend.profilePicture} color={colors.green} size={42} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.ink, fontWeight: '900' }}>{friend.name}</Text>
                {friend.sports?.length ? <Text style={{ color: colors.muted, marginTop: 2 }}>{friend.sports.join(', ')}</Text> : null}
              </View>
              {friend.socialRating > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={14} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontWeight: '900' }}>{friend.socialRating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </Card>

        <PrimaryButton label="Log Out" icon="log-out-outline" variant="destructive" onPress={handleLogout} />
      </ScrollView>
    </View>
  );
}
