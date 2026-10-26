import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Card, IconButton, PrimaryButton, ScreenHeader, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { attendanceFor, checkInOpen, formatSessionRange, formatSessionTime, needsNoShowCheck, playersLabel, sessionTitle, skillLabel } from '../sessionInfo';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';

const QUERY = `query($id:ID!){ getSession(id:$id){
  id sport startsAt endsAt location locationPoint{coordinates} skillLevel skillRange maxParticipants status
  completedAt cancelledAt noShowDeadline participants{id name} host{id name}
  checkInRequired checkInClosesAt checkInRadiusMeters myCheckIn
  attendance{ user{id} status noShowReports checkedInAt } myNoShowReport{ noShows reportedAt }
  ratingEligibility{ eligible reason }
} }`;
const JOIN = `mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){id participants{id name}}}`;
const LEAVE = `mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){id participants{id name}}}`;
const CHECK_IN = `mutation($sessionId:ID!,$latitude:Float!,$longitude:Float!){
  checkInToSession(sessionId:$sessionId,latitude:$latitude,longitude:$longitude){id myCheckIn}
}`;
const CANCEL = `mutation($sessionId:ID!){cancelSession(sessionId:$sessionId){id status}}`;

const statusBadges = {
  upcoming: { label: 'Upcoming', icon: 'calendar-outline', color: colors.purple },
  in_progress: { label: 'Happening now', icon: 'play-circle-outline', color: colors.gold },
  completed: { label: 'Ended', icon: 'checkmark-done', color: colors.green },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', color: colors.coral },
};

export default function LiveSessionDetailsScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Ticks so the check-in button appears and disappears on time.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

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

  // The server checks the time window and the distance to the session.
  async function checkIn() {
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Allow location access so FieldDay can confirm you are at the session.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await graphql(CHECK_IN, { sessionId: session.id, latitude: coords.latitude, longitude: coords.longitude });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel() {
    Alert.alert('Cancel this session?', 'It will be removed from Explore and nobody can join it. This can\'t be undone.', [
      { text: 'Keep session', style: 'cancel' },
      { text: 'Cancel session', style: 'destructive', onPress: () => run(CANCEL) },
    ]);
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
  const cancelled = session.status === 'cancelled';
  const canCheckIn = joined && !session.myCheckIn && checkInOpen(session, now);
  const missedCheckIn = joined && session.checkInRequired && !session.myCheckIn && !cancelled
    && new Date(session.checkInClosesAt) < now;
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

        {cancelled ? (
          <Card>
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              {isHost ? 'You' : 'The host'} cancelled this session{session.cancelledAt ? ` on ${formatSessionTime(session.cancelledAt)}` : ''}. It won&apos;t take place.
            </Text>
          </Card>
        ) : null}

        {isHost && session.status === 'upcoming' ? (
          <View style={{ gap: 10 }}>
            <PrimaryButton label="Edit session" icon="create-outline" variant="secondary" disabled={busy} onPress={() => navigation.navigate('EditSession', { session })} />
            <PrimaryButton label="Cancel session" variant="destructive" disabled={busy} onPress={confirmCancel} />
          </View>
        ) : null}

        {canCheckIn ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>Check in</Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Check in by {formatSessionTime(session.checkInClosesAt)} from within {session.checkInRadiusMeters} m of the session, or you&apos;ll be marked as a no-show.
            </Text>
            <PrimaryButton label={busy ? 'Checking in...' : 'Check in'} icon="location-outline" disabled={busy} onPress={checkIn} />
          </Card>
        ) : null}

        {joined && session.myCheckIn ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <StatusBadge label="Checked in" icon="checkmark-circle" color={colors.green} />
            <Text style={{ color: colors.text, flex: 1 }}>at {formatSessionTime(session.myCheckIn)}</Text>
          </Card>
        ) : null}

        {missedCheckIn ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <StatusBadge label="No-show" icon="close-circle" color={colors.coral} />
            <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>Check-in closed before you checked in.</Text>
          </Card>
        ) : null}

        {!ended && !cancelled && !isHost ? (
          <PrimaryButton
            label={joined ? 'Leave Session' : 'Join Session'}
            variant={joined ? 'destructive' : undefined}
            disabled={busy}
            onPress={() => run(joined ? LEAVE : JOIN, { userId: CURRENT_USER_ID })}
          />
        ) : null}

        {session.status === 'upcoming' && joined ? (
          <Card>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              {session.checkInRequired
                ? `Check in here during the first 10 minutes, from within ${session.checkInRadiusMeters} m of the session. Anyone who doesn't is marked as a no-show and gets an automatic rating of 1. The session ends on its own at ${formatSessionTime(session.endsAt)}, then everyone who checked in can rate the others.`
                : `This session ends on its own at ${formatSessionTime(session.endsAt)}. After that, everyone who joined is asked who didn't show up, then can rate the other players.`}
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
                {attendance?.status === 'NO_SHOW' ? (
                  <StatusBadge label="No-show" icon="close-circle" color={colors.coral} />
                ) : null}
                {attendance?.checkedInAt ? (
                  <StatusBadge label="Checked in" icon="checkmark-circle" color={colors.green} />
                ) : null}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
