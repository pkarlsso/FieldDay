import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Card, IconButton, PrimaryButton, ScreenHeader, StatusBadge } from '../components/ui';
import CooldownNotice, { isCoolingDown } from '../components/CooldownNotice';
import { colors } from '../theme';
import { attendanceFor, changesFrozen, commitmentWarning, formatSessionRange, hostIsAlone, formatSessionTime, joinClosed, needsNoShowCheck, playersLabel, sessionTitle, skillLabel } from '../sessionInfo';
import { useCurrentUser } from '../useCurrentUser';
import { affectsSessions, useSessionUpdates } from '../useSessionUpdates';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';

const QUERY = `query($id:ID!){ getSession(id:$id){
  id sport startsAt endsAt location locationPoint{coordinates} skillLevel skillRange maxParticipants status visibility
  completedAt cancelledAt noShowDeadline participants{id name} host{id name}
  fullOnly joinClosesAt changesFreezeAt invalidReason
  attendance{ user{id} status noShowReports } myNoShowReport{ noShows reportedAt }
  ratingEligibility{ eligible reason }
} }`;
const JOIN = `mutation($sessionId:ID!){joinSession(sessionId:$sessionId){id participants{id name}}}`;
const LEAVE = `mutation($sessionId:ID!){leaveSession(sessionId:$sessionId){id participants{id name}}}`;
const CANCEL = `mutation($sessionId:ID!){cancelSession(sessionId:$sessionId){id status}}`;

const statusBadges = {
  upcoming: { label: 'Upcoming', icon: 'calendar-outline', color: colors.purple },
  in_progress: { label: 'Happening now', icon: 'play-circle-outline', color: colors.gold },
  completed: { label: 'Ended', icon: 'checkmark-done', color: colors.green },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', color: colors.coral },
  invalid: { label: 'Not happening', icon: 'remove-circle-outline', color: colors.coral },
};

const visibilityBadges = {
  FRIENDS: { label: 'Friends only', icon: 'people-outline', color: colors.blue },
  INVITE_ONLY: { label: 'Invite only', icon: 'lock-closed-outline', color: colors.blue },
};

export default function LiveSessionDetailsScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Ticks so the join, leave and edit buttons lock on time.
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
  // And whenever someone else joins or leaves, or the session starts or ends.
  useSessionUpdates(useCallback((events) => {
    if (affectsSessions(events, [sessionId])) load();
  }, [load, sessionId]));

  const me = useCurrentUser();
  const [blockedUntil, setBlockedUntil] = useState(null);
  const cooldownUntil = blockedUntil || me?.cooldownUntil;

  async function run(mutation) {
    setBusy(true);
    let message = '';
    try {
      await graphql(mutation, { sessionId: session.id });
    } catch (err) {
      if (err.code === 'ACCOUNT_COOLDOWN') setBlockedUntil(err.extensions.cooldownUntil);
      else message = err.message;
    }
    // Refetch either way: a failed join usually means this screen was stale
    // (someone took the last spot), so show what's actually there now.
    await load();
    if (message) setError(message);
    setBusy(false);
  }

  // #377: say what joining commits the player to before they join.
  function confirmJoin() {
    const { title, message } = commitmentWarning(session);
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Join session', onPress: () => run(JOIN) },
    ]);
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
  const invalid = session.status === 'invalid';
  // Sessions that didn't go ahead read "cancelled" once their end has passed,
  // but weren't cancelled by the host; invalidReason says why.
  const didntHappen = Boolean(session.invalidReason) && (invalid || cancelled);
  const hostCancelled = cancelled && !session.invalidReason;
  const upcoming = session.status === 'upcoming';
  const frozen = changesFrozen(session, now);
  const joinIsClosed = joinClosed(session, now);
  const full = session.participants.length >= session.maxParticipants;
  const spotsLeft = Math.max(0, session.maxParticipants - session.participants.length);
  const coolingDown = !joined && isCoolingDown(cooldownUntil);
  const owesNoShowCheck = joined && needsNoShowCheck(session);
  const canChangeNoShows = joined && ended && session.myNoShowReport
    && new Date(session.noShowDeadline) > new Date() && session.ratingEligibility.eligible;

  let joinLabel = 'Join Session';
  if (joined) joinLabel = frozen ? 'Leaving is locked' : 'Leave Session';
  else if (joinIsClosed) joinLabel = 'Joining closed';
  else if (full) joinLabel = 'Session is full';

  let leaveNote = '';
  if (isHost && !session.fullOnly) {
    // The host only has to go once someone else joins (#360).
    leaveNote = hostIsAlone(session)
      ? `Nobody else has joined yet, so you only need to go if someone does. If nobody joins by ${formatSessionTime(session.joinClosesAt)}, 1 hour before the start, the session is called off. `
      : 'Other players have joined, so you\'re expected to show up. ';
  }
  if (!isHost) {
    leaveNote = frozen
      ? 'This session starts within 2 hours, so you can no longer leave it. '
      : `You can leave until ${formatSessionTime(session.changesFreezeAt)}, 2 hours before it starts. `;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Session Details" left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 14 }}>
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusBadge {...(statusBadges[session.status] || statusBadges.upcoming)} />
            {visibilityBadges[session.visibility] ? <StatusBadge {...visibilityBadges[session.visibility]} /> : null}
            {session.fullOnly ? <StatusBadge label="Only if full" icon="people-circle-outline" color={colors.gold} /> : null}
          </View>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{sessionTitle(session)}</Text>
          <Text style={{ color: colors.text }}>{formatSessionRange(session.startsAt, session.endsAt)}</Text>
          <Text style={{ color: colors.text }}>{playersLabel(session)} • {skillLabel(session)}</Text>
          <Text style={{ color: colors.text }}>Host: {isHost ? 'You' : session.host?.name}</Text>
        </Card>

        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}

        {hostCancelled ? (
          <Card>
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              {isHost ? 'You' : 'The host'} cancelled this session{session.cancelledAt ? ` on ${formatSessionTime(session.cancelledAt)}` : ''}. It won&apos;t take place.
            </Text>
          </Card>
        ) : null}

        {didntHappen ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>
              {invalid ? 'This session is not happening' : 'This session was cancelled'}
            </Text>
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              {session.invalidReason}{invalid ? ' Nobody needs to go.' : ''} Nobody is marked as a no-show or rated.
            </Text>
          </Card>
        ) : null}

        {session.fullOnly && upcoming ? (
          <Card style={{ gap: 6, backgroundColor: colors.goldSoft }}>
            <Text style={{ color: colors.ink, fontWeight: '900' }}>Only happens if it&apos;s full</Text>
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              {full
                ? 'Every spot is taken, so this session is on.'
                : `${spotsLeft} more player${spotsLeft === 1 ? '' : 's'} needed by ${formatSessionTime(session.joinClosesAt)}, when joining closes. If it isn't full by then, the session is called off and nobody needs to show up.`}
            </Text>
          </Card>
        ) : null}

        {isHost && upcoming && !frozen ? (
          <View style={{ gap: 10 }}>
            <PrimaryButton label="Edit session" icon="create-outline" variant="secondary" disabled={busy} onPress={() => navigation.navigate('EditSession', { session })} />
            <PrimaryButton label="Cancel session" variant="destructive" disabled={busy} onPress={confirmCancel} />
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              You can edit or cancel until {formatSessionTime(session.changesFreezeAt)}, 2 hours before it starts.
            </Text>
          </View>
        ) : null}

        {isHost && upcoming && frozen ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <Text style={{ color: colors.text, flex: 1, lineHeight: 20 }}>
              This session starts within 2 hours, so it can no longer be edited or cancelled.
            </Text>
          </Card>
        ) : null}

        {upcoming && !isHost && coolingDown ? <CooldownNotice until={cooldownUntil} /> : null}

        {upcoming && !isHost && !coolingDown ? (
          <PrimaryButton
            label={joinLabel}
            variant={joined ? 'destructive' : undefined}
            disabled={busy || (joined ? frozen : (full || joinIsClosed))}
            onPress={() => (joined ? run(LEAVE) : confirmJoin())}
          />
        ) : null}

        {upcoming && joined ? (
          <Card>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              {leaveNote}
              {`This session ends on its own at ${formatSessionTime(session.endsAt)}. After that, everyone who joined is asked who didn't show up, then can rate the other players.`}
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
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
