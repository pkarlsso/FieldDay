import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card, IconButton, PrimaryButton, ScreenHeader, SportIcon } from '../components/ui';
import { colors } from '../theme';
import { formatSessionRange, formatSessionTime, sessionTitle } from '../sessionInfo';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';

const QUERY = `query($id:ID!){ getSession(id:$id){
  id sport location startsAt endsAt status noShowDeadline
  participants{ id name profilePicture }
  myNoShowReport{ noShows reportedAt }
} }`;
const REPORT = `mutation($sessionId:ID!,$noShowUserIds:[ID!]!){
  reportNoShows(sessionId:$sessionId,noShowUserIds:$noShowUserIds){ id ratingEligibility{ eligible reason } }
}`;

// Asks one participant which of the other players didn't come. Everyone is
// assumed to have shown up until tapped.
export default function LiveNoShowScreen({ route, navigation }) {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [noShows, setNoShows] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    graphql(QUERY, { id: sessionId })
      .then(({ getSession }) => {
        if (!active) return;
        setSession(getSession);
        // Re-opening the check shows the previous answer.
        setNoShows(Object.fromEntries((getSession.myNoShowReport?.noShows || []).map((id) => [id, true])));
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [sessionId]));

  const header = <ScreenHeader title="Who didn't show up?" left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />} />;

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

  const others = session.participants.filter((player) => player.id !== CURRENT_USER_ID);
  const flagged = others.filter((player) => noShows[player.id]);
  // Open from the end of the session until the deadline; answers can be changed until then.
  const open = session.status === 'completed' && Boolean(session.noShowDeadline) && new Date(session.noShowDeadline) > new Date();

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const { reportNoShows } = await graphql(REPORT, { sessionId: session.id, noShowUserIds: flagged.map((player) => player.id) });
      if (reportNoShows.ratingEligibility.eligible && others.length > flagged.length) {
        navigation.replace('RateSession', { sessionId: session.id });
      } else {
        navigation.goBack();
      }
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

        <Text style={{ color: colors.text, lineHeight: 21 }}>
          Tap anyone who didn&apos;t come. A player is marked as a no-show when most of the people who answer say so, and no-shows can&apos;t rate the session.
          {session.noShowDeadline ? ` Answer by ${formatSessionTime(session.noShowDeadline)}.` : ''}
        </Text>

        {!open ? (
          <Card><Text style={{ color: colors.text }}>The no-show check for this session is closed.</Text></Card>
        ) : null}

        {open && others.length === 0 ? (
          <Card><Text style={{ color: colors.text }}>Nobody else joined this session, so there&apos;s no one to report.</Text></Card>
        ) : null}

        {open ? others.map((player) => {
          const missing = Boolean(noShows[player.id]);
          return (
            <TouchableOpacity
              key={player.id}
              activeOpacity={0.85}
              onPress={() => setNoShows((current) => ({ ...current, [player.id]: !current[player.id] }))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: missing }}
              accessibilityLabel={`${player.name} didn't show up`}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: missing ? colors.coral : colors.line }}>
                <Avatar name={player.name} uri={player.profilePicture} color={missing ? colors.coral : colors.purple} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '900' }}>{player.name}</Text>
                  <Text style={{ color: missing ? colors.coral : colors.green, marginTop: 3, fontWeight: '800' }}>
                    {missing ? "Didn't show up" : 'Showed up'}
                  </Text>
                </View>
                <Ionicons name={missing ? 'close-circle' : 'checkmark-circle'} size={26} color={missing ? colors.coral : colors.green} />
              </Card>
            </TouchableOpacity>
          );
        }) : null}

        {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}

        {open ? (
          <PrimaryButton
            label={submitting
              ? 'Sending...'
              : flagged.length
                ? `Report ${flagged.length} no-show${flagged.length === 1 ? '' : 's'}`
                : 'Everyone showed up'}
            icon={submitting ? undefined : 'checkmark-circle-outline'}
            disabled={submitting}
            onPress={submit}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
