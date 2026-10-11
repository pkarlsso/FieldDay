import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, IconButton, PrimaryButton, ScreenHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { attendanceFor, formatSessionRange, formatSessionTime, needsNoShowCheck, playersLabel, sessionTitle, skillLabel } from '../sessionInfo';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';

const QUERY = `query($id:ID!){ getSession(id:$id){
  id sport startsAt endsAt location locationPoint{coordinates} skillLevel skillRange maxParticipants status
  completedAt noShowDeadline participants{id name} host{id name}
  attendance{ user{id} status noShowReports } myNoShowReport{ noShows reportedAt }
  ratingEligibility{ eligible reason }
} }`;
const JOIN = `mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){id participants{id name}}}`;
const LEAVE = `mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){id participants{id name}}}`;

const statusBadges = {
  upcoming: { label: 'Upcoming', icon: 'calendar-outline', color: colors.purple },
  in_progress: { label: 'Happening now', icon: 'play-circle-outline', color: colors.gold },
  completed: { label: 'Ended', icon: 'checkmark-done', color: colors.green },
};

export default function LiveSessionDetailsScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSession((await graphql(QUERY, { id: sessionId })).getSession);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [sessionId]);

  // Refetch on focus so no-show answers and ratings from the next screens show up here.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function run(mutation, variables) {
    setBusy(true);
    try {
      await graphql(mutation, { sessionId: session.id, ...variables });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {error ? <Text>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const isHost = session.host?.id === CURRENT_USER_ID;
  const joined = session.participants.some((user) => user.id === CURRENT_USER_ID);
  const ended = session.status === 'completed';
  const owesNoShowCheck = joined && needsNoShowCheck(session);
  const canChangeNoShows = joined && ended && session.myNoShowReport
    && new Date(session.noShowDeadline) > new Date() && session.ratingEligibility.eligible;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Session Details" left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 14 }}>
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row' }}><StatusBadge {...(statusBadges[session.status] || statusBadges.upcoming)} /></View>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{sessionTitle(session)}</Text>
          <Text style={{ color: colors.text }}>{formatSessionRange(session.startsAt, session.endsAt)}</Text>
          <Text style={{ color: colors.text }}>{playersLabel(session)} • {skillLabel(session)}</Text>
          <Text style={{ color: colors.text }}>Host: {isHost ? 'You' : session.host?.name}</Text>
        </Card>

        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}

        {!ended && !isHost ? (
          <PrimaryButton
            label={joined ? 'Leave Session' : 'Join Session'}
            variant={joined ? 'destructive' : undefined}
            disabled={busy}
            onPress={() => run(joined ? LEAVE : JOIN, { userId: CURRENT_USER_ID })}
          />
        ) : null}

        {!ended && joined ? (
          <Card>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              This session ends on its own at {formatSessionTime(session.endsAt)}. After that, everyone who joined is asked who didn&apos;t show up, then can rate the other players.
            </Text>
          </Card>
        ) : null}

        {owesNoShowCheck ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>Did everyone show up?</Text>
            <Text style={{ color: colors.muted }}>
              Answer by {formatSessionTime(session.noShowDeadline)} to rate the other players.
            </Text>
            <PrimaryButton label="Check who showed up" icon="people-outline" onPress={() => navigation.navigate('ReportNoShows', { sessionId: session.id })} />
          </Card>
        ) : null}

        {ended && joined && !owesNoShowCheck ? (
          session.ratingEligibility.eligible ? (
            <PrimaryButton label="Rate players" icon="star-outline" onPress={() => navigation.navigate('RateSession', { sessionId: session.id })} />
          ) : (
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <StatusBadge label="Rating" icon="star-outline" color={colors.muted} />
              <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>{session.ratingEligibility.reason}</Text>
            </Card>
          )
        ) : null}

        {canChangeNoShows ? (
          <PrimaryButton label="Change who didn't show up" variant="secondary" onPress={() => navigation.navigate('ReportNoShows', { sessionId: session.id })} />
        ) : null}

        <Card>
          <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>Players</Text>
          {session.participants.map((user) => {
            const attendance = attendanceFor(session, user.id);
            return (
              <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                <Text style={{ color: colors.text, flex: 1 }}>
                  {user.name}{user.id === session.host?.id ? ' (host)' : ''}
                </Text>
                {ended && attendance?.status === 'NO_SHOW' ? (
                  <StatusBadge label="No-show" icon="close-circle" color={colors.coral} />
                ) : null}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
