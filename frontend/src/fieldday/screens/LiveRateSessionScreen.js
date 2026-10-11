import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Avatar, Card, IconButton, PrimaryButton, ScreenHeader, SportIcon, StatusBadge } from '../components/ui';
import { colors } from '../theme';
import { attendanceFor, formatSessionRange, needsNoShowCheck, sessionTitle } from '../sessionInfo';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';

const QUERY = `query($id:ID!){ getSession(id:$id){
  id sport startsAt endsAt location status noShowDeadline participants{id name profilePicture}
  attendance{ user{id} status } myNoShowReport{ noShows } ratingEligibility{ eligible reason }
} }`;
const SUBMIT_RATINGS = `
  mutation SubmitRatings($sessionId: ID!, $raterId: ID!, $ratings: [RatingInput!]!) {
    submitRatings(sessionId: $sessionId, raterId: $raterId, ratings: $ratings) {
      success avgRatingGiven friendRequestsSent
    }
  }
`;

const attendanceText = {
  SHOWED_UP: { label: 'Showed up', color: colors.green },
  NO_SHOW: { label: 'Reported as a no-show by others', color: colors.coral },
};
const DEFAULT_RATING = 4;

// Everyone else in the session except the players you reported as no-shows.
function playersToRate(session) {
  const reported = new Set(session.myNoShowReport?.noShows || []);
  return session.participants.filter((player) => player.id !== CURRENT_USER_ID && !reported.has(player.id));
}

export default function LiveRateSessionScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [ratings, setRatings] = useState({});
  const [friends, setFriends] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    graphql(QUERY, { id: sessionId })
      .then(({ getSession }) => {
        if (!active) return;
        setSession(getSession);
        setRatings(Object.fromEntries(playersToRate(getSession).map((player) => [player.id, DEFAULT_RATING])));
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [sessionId]));

  const header = <ScreenHeader title="Rate Session" left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />} />;

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        {header}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18 }}>
          {error ? <Text style={{ color: colors.coral }}>{error}</Text> : <ActivityIndicator color={colors.purple} />}
        </View>
      </View>
    );
  }

  const players = playersToRate(session);

  // The server makes the final call; this explains why the form is not shown.
  if (!session.ratingEligibility.eligible || players.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        {header}
        <View style={{ padding: 18, gap: 14 }}>
          <Card style={{ gap: 8 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>You can&apos;t rate this session</Text>
            <Text style={{ color: colors.text, lineHeight: 20 }}>
              {session.ratingEligibility.eligible
                ? 'Everyone else in this session was reported as a no-show, so there is no one to rate.'
                : session.ratingEligibility.reason}
            </Text>
          </Card>
          {needsNoShowCheck(session) ? (
            <PrimaryButton label="Check who showed up" icon="people-outline" onPress={() => navigation.replace('ReportNoShows', { sessionId: session.id })} />
          ) : null}
          <PrimaryButton label="Back to session" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const { submitRatings } = await graphql(SUBMIT_RATINGS, {
        sessionId: session.id,
        raterId: CURRENT_USER_ID,
        ratings: players.map((player) => ({ userId: player.id, rating: ratings[player.id], addFriend: Boolean(friends[player.id]) })),
      });
      navigation.replace('SessionComplete', {
        title: sessionTitle(session),
        avgRatingGiven: submitRatings.avgRatingGiven,
        friendRequestsSent: submitRatings.friendRequestsSent,
        playersRated: players.length,
        ratedPlayers: players.map((player) => ({ id: player.id, name: player.name, rating: ratings[player.id] })),
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 14 }}>
        <Card style={{ backgroundColor: colors.purpleSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SportIcon sport={session.sport} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>{sessionTitle(session)}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{formatSessionRange(session.startsAt, session.endsAt)}</Text>
            </View>
          </View>
        </Card>

        {players.map((player) => {
          const status = attendanceText[attendanceFor(session, player.id)?.status ?? 'SHOWED_UP'];
          return (
            <Card key={player.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={player.name} uri={player.profilePicture} color={colors.purple} size={50} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>{player.name}</Text>
                  <Text style={{ color: status.color, marginTop: 3, fontWeight: '800' }}>{status.label}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFriends((value) => ({ ...value, [player.id]: !value[player.id] }))}
                  accessibilityLabel={`Add ${player.name} as a friend`}
                >
                  <StatusBadge
                    label={friends[player.id] ? 'Friend' : 'Add'}
                    icon={friends[player.id] ? 'person-add' : 'person-add-outline'}
                    color={friends[player.id] ? colors.green : colors.muted}
                  />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>1</Text>
                  <Text style={{ color: colors.purple, fontSize: 20, fontWeight: '900' }}>{ratings[player.id]}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>5</Text>
                </View>
                <Slider
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={ratings[player.id]}
                  minimumTrackTintColor={colors.purple}
                  maximumTrackTintColor={colors.line}
                  thumbTintColor={colors.purple}
                  onValueChange={(value) => setRatings((current) => ({ ...current, [player.id]: Math.round(value) }))}
                />
              </View>
            </Card>
          );
        })}

        {error ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.coral} />
            <Text style={{ color: colors.coral, flex: 1 }}>{error}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={submitting ? 'Sending ratings...' : 'Submit Ratings'}
          icon={submitting ? undefined : 'checkmark-circle-outline'}
          disabled={submitting}
          onPress={submit}
        />
      </ScrollView>
    </View>
  );
}
