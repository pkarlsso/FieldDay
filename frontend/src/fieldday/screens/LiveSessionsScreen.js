import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Card, NotificationButton, PrimaryButton, ScreenHeader } from '../components/ui';
import SessionRow from '../components/SessionRow';
import { colors } from '../theme';
import { groupMySessions, needsNoShowCheck } from '../sessionInfo';
import { useMySessions } from '../useMySessions';

function completedBadge(session) {
  if (needsNoShowCheck(session)) return { label: 'No-shows?', icon: 'people-outline', color: colors.gold };
  if (session.ratingEligibility.eligible) return { label: 'Rate', icon: 'star', color: colors.coral };
  return { label: 'Done', icon: 'checkmark-circle', color: colors.green };
}

function Section({ title, empty, children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>{title}</Text>
      {hasItems ? children : <Text style={{ color: colors.muted }}>{empty}</Text>}
    </View>
  );
}

export default function LiveSessionsScreen({ navigation }) {
  const { data, error, loading, refreshing, refresh } = useMySessions();
  const groups = groupMySessions(data);
  const hasAny = groups.upcoming.length + groups.happeningNow.length + groups.completed.length > 0;
  const open = (session) => navigation.navigate('SessionDetails', { sessionId: session.id });

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="My Sessions" right={<NotificationButton onPress={() => navigation.navigate('Notifications')} />} />
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 22 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.purple} />}
      >
        {loading ? <ActivityIndicator color={colors.purple} /> : null}
        {error ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.coral }}>{error}</Text>
            <PrimaryButton label="Try again" variant="secondary" onPress={refresh} />
          </Card>
        ) : null}

        {data && !hasAny ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900' }}>No sessions yet</Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Games you host or join show up here, along with completed sessions to rate.
            </Text>
            <PrimaryButton label="Find a game" icon="map-outline" onPress={() => navigation.navigate('Explore')} />
            <PrimaryButton label="Host a game" icon="add-circle-outline" variant="secondary" onPress={() => navigation.navigate('Create')} />
          </Card>
        ) : null}

        {data && hasAny ? (
          <>
            {groups.happeningNow.length ? (
              <Section title="Happening now">
                {groups.happeningNow.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    onPress={() => open(session)}
                    badge={{ label: 'Live', icon: 'play-circle-outline', color: colors.gold }}
                  />
                ))}
              </Section>
            ) : null}

            <Section title="Hosting" empty="You are not hosting any upcoming sessions.">
              {groups.hostedUpcoming.map((session) => (
                <SessionRow key={session.id} session={session} onPress={() => open(session)} badge={{ label: 'Host', icon: 'star-outline', color: colors.purple }} />
              ))}
            </Section>

            <Section title="Joined" empty="You have not joined any upcoming sessions. Find one in Explore.">
              {groups.joinedUpcoming.map((session) => (
                <SessionRow key={session.id} session={session} onPress={() => open(session)} />
              ))}
            </Section>

            <Section title="Ended" empty="Sessions show up here once they end.">
              {groups.completed.map((session) => (
                <SessionRow key={session.id} session={session} onPress={() => open(session)} badge={completedBadge(session)} />
              ))}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
