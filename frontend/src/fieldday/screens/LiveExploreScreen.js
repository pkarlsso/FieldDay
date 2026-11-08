import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, Pill, ScreenHeader, SportIcon } from '../components/ui';
import { colors, sports } from '../theme';
import { DEFAULT_DISCOVERY_FILTER, getDiscoveryOrigin, loadDiscoverySessions, loadRecommendedSessions } from '../discovery';
import { formatSessionTime, playersLabel, skillLabel } from '../sessionInfo';
import { useSessionUpdates } from '../useSessionUpdates';
import MapScreen from './MapScreen';
import logger from '../../logger';

const sportOptions = Object.keys(sports);
const radiusOptions = [5, 10, 25, 50];
const VIEW_MODES = [{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }];

// Switches Explore between the session list and the map, which used to be its
// own tab (#363).
function ViewSwitch({ mode, onChange }) {
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: 18, marginBottom: 8, padding: 4, borderRadius: 14, backgroundColor: colors.purpleSoft }}>
      {VIEW_MODES.map((option) => {
        const active = option.value === mode;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: active ? colors.card : 'transparent' }}
          >
            <Text style={{ color: active ? colors.purple : colors.muted, fontWeight: '900' }}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const skillOptions = [
  { label: 'Any skill', min: undefined, max: undefined },
  { label: 'Beginner', min: 1, max: 2 },
  { label: 'Intermediate', min: 2, max: 4 },
  { label: 'Advanced', min: 4, max: 5 },
];

export default function LiveExploreScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [mode, setMode] = useState('list');
  const [locating, setLocating] = useState(true);
  const [origin, setOrigin] = useState(null);
  const [draft, setDraft] = useState(DEFAULT_DISCOVERY_FILTER);
  // The filter behind the list on screen, so live updates refetch the same list.
  const appliedFilter = useRef(null);
  const load = useCallback(async (nextFilter) => {
    appliedFilter.current = nextFilter;
    try {
      const [discovered, recommended] = await Promise.all([
        loadDiscoverySessions(nextFilter),
        loadRecommendedSessions({ origin: nextFilter.origin, maxDistanceMiles: nextFilter.maxDistanceMiles, limit: 5 })
          .catch((error) => {
            logger.warn('Could not load recommendations:', error);
            return [];
          }),
      ]);
      setSessions(discovered);
      setRecommendations(recommended);
      setError('');
    }
    catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    getDiscoveryOrigin().then(async (location) => {
      setOrigin(location);
      const next = { ...DEFAULT_DISCOVERY_FILTER, origin: location || undefined };
      setDraft(next);
      await load(next);
    }).catch(async (error) => {
      logger.warn('Could not determine discovery location:', error);
      setOrigin(null);
      const next = { ...DEFAULT_DISCOVERY_FILTER, origin: undefined };
      setDraft(next);
      await load(next);
    }).finally(() => setLocating(false));
  }, [load]);

  // Player counts and open spots change as people join and leave elsewhere.
  useSessionUpdates(useCallback(() => {
    if (appliedFilter.current) load(appliedFilter.current);
  }, [load]));

  const toggleSport = (sport) => setDraft((current) => ({
    ...current,
    sports: current.sports.includes(sport)
      ? current.sports.filter((value) => value !== sport)
      : [...current.sports, sport],
  }));

  const applyFilters = () => {
    const next = { ...draft, origin: draft.origin || origin };
    setShowFilters(false);
    load(next);
  };

  const clearFilters = () => {
    const next = { ...DEFAULT_DISCOVERY_FILTER, origin };
    setDraft(next);
    load(next);
  };

  const filtersButton = mode === 'list'
    ? <TouchableOpacity onPress={() => setShowFilters((value) => !value)}><Text style={{ color: colors.purple, fontWeight: '900' }}>{showFilters ? 'Close' : 'Filters'}</Text></TouchableOpacity>
    : undefined;

  if (mode === 'map') {
    return <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Explore" />
      <ViewSwitch mode={mode} onChange={setMode} />
      <View style={{ flex: 1 }}><MapScreen navigation={navigation} /></View>
    </View>;
  }

  return <View style={{ flex: 1, backgroundColor: colors.page }}>
    <ScreenHeader title="Explore" right={filtersButton} />
    <ViewSwitch mode={mode} onChange={setMode} />
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 10, gap: 12 }}>
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
      {recommendations.length ? <View style={{ gap: 10 }}>
        <View>
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '900' }}>Picked for you</Text>
          <Text style={{ color: colors.muted, marginTop: 3 }}>Games selected for your interests and location.</Text>
        </View>
        {recommendations.map(({ session, reasons }) => <TouchableOpacity key={`recommended-${session.id}`} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: colors.purpleSoft, borderWidth: 1 }}>
            <SportIcon sport={session.sport} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{session.sport} at {session.location}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{formatSessionTime(session.startsAt)}{session.distanceMiles !== null ? ` • ${session.distanceMiles.toFixed(1)} mi` : ''}</Text>
              <Text style={{ color: colors.purpleDark, marginTop: 4, fontWeight: '700' }}>{reasons.filter((reason) => reason !== 'Ranked by Gorse').slice(0, 2).join(' · ') || 'A session you might enjoy'}</Text>
            </View>
          </Card>
        </TouchableOpacity>)}
      </View> : null}
      {sessions.length ? <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 8 }}>Explore sessions</Text> : null}
      {!sessions.length && !error && !locating ? <Text style={{ color: colors.muted }}>No sessions match these filters.</Text> : null}
      {sessions.map((session) => <TouchableOpacity key={session.id} onPress={() => navigation.navigate('SessionDetails', { sessionId: session.id })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SportIcon sport={session.sport} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontWeight: '900', fontSize: 16 }}>{session.sport} at {session.location}</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{formatSessionTime(session.startsAt)}{session.distanceMiles !== null ? ` • ${session.distanceMiles.toFixed(1)} mi` : ''}</Text>
            <Text style={{ color: colors.text, marginTop: 4, fontWeight: '700' }}>{playersLabel(session)} • {skillLabel(session)}</Text>
          </View>
        </Card>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}
