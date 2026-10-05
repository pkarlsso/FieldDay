import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Card, HeaderActionRow, NotificationButton, PrimaryButton, ScreenHeader, SportIcon, Stat } from '../components/ui';
import { colors } from '../theme';
import { buildActivity, formatSessionRange, formatSessionTime, groupMySessions, playersLabel, sessionTitle, skillLabel } from '../sessionInfo';
import { useMySessions } from '../useMySessions';
import { firstName, useCurrentUser } from '../useCurrentUser';
import { CURRENT_USER_ID } from '../../config';

// What the user should do next, most urgent first.
function buildTodos(groups) {
  return [
    ...groups.needsNoShowCheck.map((session) => ({ session, icon: 'people-outline', label: "Tell us who didn't show up", screen: 'ReportNoShows' })),
    ...groups.needsRating.map((session) => ({ session, icon: 'star-outline', label: 'Rate the players', screen: 'RateSession' })),
  ];
}

function ListRow({ icon, label, detail, first, onPress }) {
  const content = (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <Ionicons name={icon} size={19} color={colors.purple} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontWeight: '900' }}>{label}</Text>
        <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 19 }}>{detail}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.8} onPress={onPress}>{content}</TouchableOpacity> : content;
}

export default function LiveHomeScreen({ navigation }) {
  const user = useCurrentUser();
  const { data, error, loading, refreshing, refresh } = useMySessions();
  const groups = groupMySessions(data);
  // A session that's under way counts as "next" until it ends.
  const nextSession = groups.happeningNow[0] || groups.upcoming[0];
  const todos = buildTodos(groups);
  const activity = buildActivity(data, CURRENT_USER_ID);
  const rating = user?.socialRating > 0 ? user.socialRating.toFixed(1) : '—';
  const open = (session) => navigation.navigate('SessionDetails', { sessionId: session.id });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader
        eyebrow="FIELD DAY"
        title={user ? `Welcome back, ${firstName(user)}` : 'Welcome back'}
        subtitle="Your upcoming sessions and what needs your attention."
        right={
          <HeaderActionRow>
            <NotificationButton onPress={() => navigation.navigate('Notifications')} />
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Avatar name={user?.name || ''} uri={user?.profilePicture} color={colors.purple} size={44} />
            </TouchableOpacity>
          </HeaderActionRow>
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.purple} />}
      >
        <Card style={{ backgroundColor: colors.purple }}>
          <TouchableOpacity activeOpacity={0.86} disabled={!nextSession} onPress={() => nextSession && open(nextSession)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {nextSession ? (
                <SportIcon sport={nextSession.sport} size={58} />
              ) : (
                <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={colors.card} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.card, fontSize: 13, fontWeight: '800', opacity: 0.9 }}>
                  {nextSession && groups.happeningNow.includes(nextSession) ? 'HAPPENING NOW' : 'NEXT SESSION'}
                </Text>
                {loading ? <ActivityIndicator color={colors.card} style={{ alignSelf: 'flex-start', marginTop: 8 }} /> : null}
                {data && nextSession ? (
                  <>
                    <Text style={{ color: colors.card, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{sessionTitle(nextSession)}</Text>
                    <Text style={{ color: colors.card, fontSize: 14, marginTop: 6, opacity: 0.9 }}>
                      {formatSessionRange(nextSession.startsAt, nextSession.endsAt)} • {playersLabel(nextSession)} • {skillLabel(nextSession)}
                    </Text>
                  </>
                ) : null}
                {data && !nextSession ? (
                  <>
                    <Text style={{ color: colors.card, fontSize: 22, fontWeight: '900', marginTop: 4 }}>Nothing scheduled</Text>
                    <Text style={{ color: colors.card, fontSize: 14, marginTop: 6, opacity: 0.9 }}>Find a game nearby or host your own.</Text>
                  </>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 12 }}>
            <Stat value={rating} label="rating" color={colors.card} labelColor={colors.card} />
            <Stat value={data ? String(groups.upcoming.length) : '—'} label="upcoming" color={colors.card} labelColor={colors.card} />
            <Stat value={data ? String(groups.completed.length) : '—'} label="played" color={colors.card} labelColor={colors.card} />
            <Stat value={data ? String(todos.length) : '—'} label="to do" color={colors.card} labelColor={colors.card} />
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
            onPress={() => navigation.navigate('Create')}
            style={{ flex: 1, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 18, borderCurve: 'continuous', padding: 16 }}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={30} color={colors.purple} />
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16, marginTop: 10 }}>Host a game</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.coral }}>{error}</Text>
            <PrimaryButton label="Try again" variant="secondary" onPress={refresh} />
          </Card>
        ) : null}

        {data ? (
          <Card>
            <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>Needs your attention</Text>
            {todos.length ? todos.map((todo, index) => (
              <ListRow
                key={`${todo.session.id}-${todo.label}`}
                first={index === 0}
                icon={todo.icon}
                label={todo.label}
                detail={sessionTitle(todo.session)}
                onPress={() => navigation.navigate(todo.screen, { sessionId: todo.session.id })}
              />
            )) : <Text style={{ color: colors.muted, marginTop: 6 }}>You are all caught up.</Text>}
          </Card>
        ) : null}

        {data ? (
          <Card>
            <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>Recent activity</Text>
            {activity.length ? activity.map((item, index) => (
              <ListRow key={item.id} first={index === 0} icon={item.icon} label={item.label} detail={`${item.detail} • ${formatSessionTime(item.at)}`} />
            )) : (
              <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
                Nothing yet. Join a game from Explore or host one, and your activity will show up here.
              </Text>
            )}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
