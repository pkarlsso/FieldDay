import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Card, IconButton, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors } from '../theme';
import { graphql, CURRENT_USER_ID } from '../../../src/api';

const QUERY = `query($id:ID!){ getSession(id:$id){ id sport startsAt location locationPoint{coordinates} maxParticipants participants{id name} host{id name} status } }`;
const JOIN = `mutation($sessionId:ID!,$userId:ID!){joinSession(sessionId:$sessionId,userId:$userId){id participants{id name}}}`;
const LEAVE = `mutation($sessionId:ID!,$userId:ID!){leaveSession(sessionId:$sessionId,userId:$userId){id participants{id name}}}`;

export default function LiveSessionDetailsScreen({ route, navigation }) {
  const [session, setSession] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setSession((await graphql(QUERY, { id: route.params.sessionId })).getSession); } catch (err) { setError(err.message); } }, [route.params.sessionId]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function change(mutation) { try { await graphql(mutation, { sessionId: session.id, userId: CURRENT_USER_ID }); await load(); } catch (err) { setError(err.message); } }
  if (!session) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>{error ? <Text>{error}</Text> : <ActivityIndicator />}</View>;
  const joined = session.participants.some((user) => user.id === CURRENT_USER_ID);
  return <View style={{ flex: 1, backgroundColor: colors.page }}><ScreenHeader title="Session Details" left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />} /><ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
    <Card style={{ gap: 8 }}><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900' }}>{session.sport} at {session.location}</Text><Text style={{ color: colors.text }}>{new Date(session.startsAt).toLocaleString()}</Text><Text style={{ color: colors.text }}>{session.participants.length}/{session.maxParticipants} joined</Text><Text style={{ color: colors.text }}>Host: {session.host.name}</Text></Card>
    {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}
    <PrimaryButton label={joined ? 'Leave Session' : 'Join Session'} variant={joined ? 'destructive' : undefined} onPress={() => change(joined ? LEAVE : JOIN)} />
    <Card><Text style={{ color: colors.ink, fontWeight: '900', fontSize: 18 }}>Players</Text>{session.participants.map((user) => <Text key={user.id} style={{ color: colors.text, marginTop: 8 }}>{user.name}</Text>)}</Card>
  </ScrollView></View>;
}
