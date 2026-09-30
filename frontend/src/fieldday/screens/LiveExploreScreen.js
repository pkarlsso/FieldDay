import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Card, ScreenHeader, SportIcon } from '../components/ui';
import { colors } from '../theme';
import { graphql } from '../../api';'
import logger from '../../logger';

const sportOptions = Object.keys(sports);
const radiusOptions = [5, 10, 25, 50];
const skillOptions = [
  { label: 'Any skill', min: undefined, max: undefined },
  { label: 'Beginner', min: 1, max: 2 },
  { label: 'Intermediate', min: 2, max: 4 },
  { label: 'Advanced', min: 4, max: 5 },
];

export default function LiveExploreScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [locating, setLocating] = useState(true);
  const [origin, setOrigin] = useState(null);
  const [draft, setDraft] = useState(DEFAULT_DISCOVERY_FILTER);
  const load = useCallback(async (nextFilter) => {
    try { setSessions(await loadDiscoverySessions(nextFilter)); setError(''); }
    catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    getDiscoveryOrigin().then(async (location) => {
      setOrigin(location);
      const next = { ...DEFAULT_DISCOVERY_FILTER, origin: location || undefined };
      setDraft(next);
      await loadDiscoverySessions(next).then(setSessions);
    }).catch(async (error) => {
      logger.warn('Could not determine discovery location:', error);
      setOrigin(null);
      const next = { ...DEFAULT_DISCOVERY_FILTER, origin: undefined };
      setDraft(next);
      await loadDiscoverySessions(next).then(setSessions);
    }).finally(() => setLocating(false));
  }, [load]);

  const toggleSport = (sport) => setDraft((current) => ({
    ...current,
    sports: current.sports.includes(sport)
      ? current.sports.filter((value) => value !== sport)
      : [...current.sports, sport],
  }));

  const applyFilters = () => {
    const next = { ...draft, origin };
    setShowFilters(false);
    load(next);
  };

  const clearFilters = () => {
    const next = { ...DEFAULT_DISCOVERY_FILTER, origin };
    setDraft(next);
    load(next);
  };

  return <View style={{ flex: 1, backgroundColor: colors.page }}>
    <ScreenHeader title="Explore" right={<TouchableOpacity onPress={() => setShowFilters((value) => !value)}><Text style={{ color: colors.purple, fontWeight: '900' }}>{showFilters ? 'Close' : 'Filters'}</Text></TouchableOpacity>} />
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
      {locating ? <Text style={{ color: colors.muted }}>Finding sessions near you...</Text> : null}
      {!locating && !origin ? <Card><Text style={{ color: colors.text, fontWeight: '800' }}>Location unavailable</Text><Text style={{ color: colors.muted, marginTop: 4 }}>Enter a location below to enable distance filtering.</Text><View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}><TextInput keyboardType="numbers-and-punctuation" placeholder="Latitude" value={draft.origin?.latitude?.toString() || ''} onChangeText={(value) => setDraft((current) => ({ ...current, origin: { ...(current.origin || {}), latitude: Number(value) } }))} style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10 }} /><TextInput keyboardType="numbers-and-punctuation" placeholder="Longitude" value={draft.origin?.longitude?.toString() || ''} onChangeText={(value) => setDraft((current) => ({ ...current, origin: { ...(current.origin || {}), longitude: Number(value) } }))} style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10 }} /></View></Card> : null}
      {showFilters ? <Card style={{ gap: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Filter sessions</Text>
        <Text style={{ color: colors.muted, fontWeight: '800' }}>Distance</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{radiusOptions.map((radius) => <Pill key={radius} label={`${radius} mi`} active={draft.maxDistanceMiles === radius} onPress={() => setDraft((current) => ({ ...current, maxDistanceMiles: radius }))} />)}</View>
        <Text style={{ color: colors.muted, fontWeight: '800' }}>Sport</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{sportOptions.map((sport) => <Pill key={sport} label={sport} active={draft.sports.includes(sport)} color={sports[sport].color} onPress={() => toggleSport(sport)} />)}</View>
        <Text style={{ color: colors.muted, fontWeight: '800' }}>Skill</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{skillOptions.map((skill) => <Pill key={skill.label} label={skill.label} active={draft.minSkillLevel === skill.min && draft.maxSkillLevel === skill.max} onPress={() => setDraft((current) => ({ ...current, minSkillLevel: skill.min, maxSkillLevel: skill.max }))} />)}</View>
        <View style={{ flexDirection: 'row', gap: 10 }}><TouchableOpacity onPress={clearFilters} style={{ flex: 1, padding: 12, alignItems: 'center' }}><Text style={{ color: colors.muted, fontWeight: '900' }}>Clear</Text></TouchableOpacity><TouchableOpacity onPress={applyFilters} style={{ flex: 1, backgroundColor: colors.purple, borderRadius: 12, padding: 12, alignItems: 'center' }}><Text style={{ color: colors.card, fontWeight: '900' }}>Apply</Text></TouchableOpacity></View>
      </Card> : null}
      {error ? <Text style={{ color: colors.coral }}>{error}</Text> : null}
      {!sessions.length && !error && !locating ? <Text style={{ color: colors.muted }}>No sessions match these filters.</Text> : null}
      {sessions.map((session) => <TouchableOpacity key={session.id} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SportIcon sport={session.sport} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{session.sport} at {session.location}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{new Date(session.startsAt).toLocaleString()} • {session.participants.length}/{session.maxParticipants}{session.distanceMiles !== null ? ` • ${session.distanceMiles.toFixed(1)} mi` : ''}</Text>
          </View>
        </Card>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}
