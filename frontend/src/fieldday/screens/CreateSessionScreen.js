import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { addResultsListener, isAvailable as hasAppleSearch, resolve, search } from '../../../modules/apple-search-completer/src';
import { Card, IconButton, Pill, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, sports } from '../theme';
import { CAPACITY_LIMITS, DEFAULT_SESSION_LENGTH_MS, SKILL_LEVELS, validateSessionForm } from '../sessionInfo';
import { graphql } from '../../api';
import { CURRENT_USER_ID } from '../../config';
import logger from '../../logger';

const MUTATION = `
  mutation CreateSession($hostId: ID!, $input: CreateSessionInput!) {
    createSession(hostId: $hostId, input: $input) { id sport startsAt location }
  }
`;

const sportOptions = Object.keys(sports);
const DEFAULT_LOCATION = 'Station 21 West Lafayette';
const DEFAULT_LOCATION_POINT = { longitude: -86.9147, latitude: 40.4259 };
const DEFAULT_CAPACITY = 6;

// Tomorrow at the top of the current hour.
function defaultStartAt() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(0, 0, 0);
  return date;
}

function defaultEndsAt(startsAt) {
  return new Date(startsAt.getTime() + DEFAULT_SESSION_LENGTH_MS);
}

// Merges the date or the time from a picker into an existing Date.
function withPart(current, part, value) {
  const next = new Date(current);
  if (part === 'date') next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
  else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
  return next;
}

function formatLength(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}

function FieldError({ message }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

export default function CreateSessionScreen({ navigation }) {
  const [sport, setSport] = useState(null);
  const [startsAt, setStartsAt] = useState(defaultStartAt);
  const [endsAt, setEndsAt] = useState(() => defaultEndsAt(startsAt));
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationPoint, setLocationPoint] = useState(DEFAULT_LOCATION_POINT);
  // False once the text is edited by hand, until a point is picked to match it.
  const [locationConfirmed, setLocationConfirmed] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(DEFAULT_CAPACITY);
  const [skillLevel, setSkillLevel] = useState(null);
  const [errors, setErrors] = useState({});
  const mapRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.trim().length < 3) {
      const timer = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(timer);
    }
    if (Platform.OS === 'ios' && hasAppleSearch) {
      const subscription = addResultsListener(({ results = [] }) => setSuggestions(results));
      search(location);
      return () => subscription?.remove();
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const results = await Location.geocodeAsync(location);
        if (active) setSuggestions(results.slice(0, 5));
      } catch (error) {
        logger.warn('Could not load location suggestions:', error);
        if (active) setSuggestions([]);
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [location]);

  async function findLocation() {
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(location);
      if (!results.length) throw new Error('No matching location found');
      const { latitude, longitude } = results[0];
      setLocationPoint({ latitude, longitude });
      setLocationConfirmed(true);
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    } catch (error) {
      logger.warn('Could not find session location:', error);
      Alert.alert('Location not found', error.message);
    } finally { setGeocoding(false); }
  }

  async function pickMapLocation(event) {
    const point = event.nativeEvent.coordinate;
    setLocationPoint(point);
    setLocationConfirmed(true);
    mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    try {
      const [result] = await Location.reverseGeocodeAsync(point);
      const label = [result?.name, result?.street, result?.city].filter(Boolean).join(', ');
      if (label) setLocation(label);
    } catch (error) {
      // The coordinate is still valid if reverse geocoding is unavailable.
      logger.warn('Could not reverse geocode session location:', error);
    }
  }

  function chooseSuggestion(result) {
    const label = [result.title, result.subtitle].filter(Boolean).join(', ');
    if (Platform.OS === 'ios' && hasAppleSearch) {
      resolve(result.title, result.subtitle).then(({ latitude, longitude }) => {
        setLocation(label || location);
        setLocationPoint({ latitude, longitude });
        setLocationConfirmed(true);
        mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
        setSuggestions([]);
      }).catch((error) => {
        logger.warn('Could not resolve selected location:', error);
        Alert.alert('Location not found', error.message);
      });
      return;
    }
    setLocation(label || location);
    setLocationPoint({ latitude: result.latitude, longitude: result.longitude });
    setLocationConfirmed(true);
    mapRef.current?.animateToRegion({ latitude: result.latitude, longitude: result.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    setSuggestions([]);
  }

  function editLocation(text) {
    setLocation(text);
    setLocationConfirmed(false);
  }

  // Moving the start moves the end with it, so the session keeps its length.
  function changeStartsAt(part, value) {
    const nextStart = withPart(startsAt, part, value);
    setEndsAt(new Date(nextStart.getTime() + (endsAt - startsAt)));
    setStartsAt(nextStart);
  }

  function changeEndsAt(part, value) {
    setEndsAt(withPart(endsAt, part, value));
  }

  function changeCapacity(delta) {
    setMaxParticipants((value) => Math.min(CAPACITY_LIMITS.max, Math.max(CAPACITY_LIMITS.min, value + delta)));
  }

  function resetForm() {
    setSport(null);
    const start = defaultStartAt();
    setStartsAt(start);
    setEndsAt(defaultEndsAt(start));
    setLocation(DEFAULT_LOCATION);
    setLocationPoint(DEFAULT_LOCATION_POINT);
    setLocationConfirmed(true);
    setMaxParticipants(DEFAULT_CAPACITY);
    setSkillLevel(null);
    setErrors({});
  }

  async function create() {
    const formErrors = validateSessionForm({ sport, startsAt, endsAt, location, locationConfirmed, maxParticipants, skillLevel });
    setErrors(formErrors);
    if (Object.keys(formErrors).length) {
      Alert.alert('Check the session details', Object.values(formErrors).join('\n'));
      return;
    }
    setLoading(true);
    try {
      const data = await graphql(MUTATION, {
        hostId: CURRENT_USER_ID,
        input: {
          sport,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          location: location.trim(),
          locationPoint,
          maxParticipants,
          skillLevel,
        },
      });
      Alert.alert('Session created', `${data.createSession.sport} at ${data.createSession.location}`);
      resetForm();
      navigation.navigate('Sessions');
    } catch (error) {
      Alert.alert('Could not create session', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <ScreenHeader title="Create Session" />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
        <Card style={{ gap: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>Sport</Text>
          <View style={styles.pillRow}>
            {sportOptions.map((option) => (
              <Pill key={option} label={option} active={sport === option} color={sports[option].color} onPress={() => setSport(option)} />
            ))}
          </View>
          <FieldError message={errors.sport} />
          <Text style={styles.label}>Start date</Text>
          <DateTimePicker
            value={startsAt}
            mode="date"
            minimumDate={new Date()}
            onValueChange={(_, value) => changeStartsAt('date', value)}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
          />
          <Text style={styles.label}>Start time</Text>
          <DateTimePicker
            value={startsAt}
            mode="time"
            onValueChange={(_, value) => changeStartsAt('time', value)}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          />
          <FieldError message={errors.startsAt} />
          <Text style={styles.label}>Ends</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <DateTimePicker
              value={endsAt}
              mode="date"
              minimumDate={startsAt}
              onValueChange={(_, value) => changeEndsAt('date', value)}
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
            />
            <DateTimePicker
              value={endsAt}
              mode="time"
              onValueChange={(_, value) => changeEndsAt('time', value)}
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
            />
            <Text style={{ color: colors.muted }}>{formatLength(endsAt - startsAt) ? `Lasts ${formatLength(endsAt - startsAt)}` : ''}</Text>
          </View>
          <FieldError message={errors.endsAt} />
          <Text style={styles.label}>Maximum players</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconButton icon="remove" onPress={() => changeCapacity(-1)} />
            <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '900', minWidth: 36, textAlign: 'center' }}>{maxParticipants}</Text>
            <IconButton icon="add" onPress={() => changeCapacity(1)} />
            <Text style={{ color: colors.muted, flex: 1 }}>including you</Text>
          </View>
          <FieldError message={errors.maxParticipants} />
          <Text style={styles.label}>Skill level</Text>
          <View style={styles.pillRow}>
            {SKILL_LEVELS.map((level) => (
              <Pill key={level.value} label={`${level.value} · ${level.label}`} active={skillLevel === level.value} onPress={() => setSkillLevel(level.value)} />
            ))}
          </View>
          <FieldError message={errors.skillLevel} />
          <Text style={styles.label}>Location</Text>
          <TextInput value={location} onChangeText={editLocation} style={styles.input} placeholder="Search for an address" />
          {suggestions.map((result, index) => <Text key={`${result.title || result.name}-${index}`} onPress={() => chooseSuggestion(result)} style={styles.suggestion}>
            {[result.title || result.name, result.subtitle || result.street, result.city, result.region].filter(Boolean).join(', ')}
          </Text>)}
          <PrimaryButton label={geocoding ? 'Finding location...' : 'Find address'} onPress={findLocation} disabled={geocoding || !location.trim()} variant="secondary" />
          <MapView ref={mapRef} style={styles.pickerMap} initialRegion={{ ...locationPoint, latitudeDelta: 0.02, longitudeDelta: 0.02 }} onPress={pickMapLocation}>
            <Marker coordinate={locationPoint} />
          </MapView>
          <FieldError message={errors.location} />
          <PrimaryButton label={loading ? 'Creating...' : 'Create Session'} onPress={create} disabled={loading} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = {
  label: { color: colors.text, fontWeight: '800', marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.card, padding: 12, color: colors.ink },
  pickerMap: { height: 220, borderRadius: 12, marginTop: 4 },
  suggestion: { color: colors.ink, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line, padding: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.coral, fontWeight: '700' },
};
