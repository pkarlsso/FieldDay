import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { PrimaryButton, ScreenHeader, Card } from '../components/ui';
import { colors } from '../theme';
import { graphql, CURRENT_USER_ID } from '../../api';

const MUTATION = `
  mutation CreateSession($hostId: ID!, $input: CreateSessionInput!) {
    createSession(hostId: $hostId, input: $input) { id sport startsAt location }
  }
`;

export default function CreateSessionScreen({ navigation }) {
  const [sport, setSport] = useState('Pickleball');
  const [startsAt, setStartsAt] = useState(new Date(Date.now() + 86400000));
  const [location, setLocation] = useState('Station 21 West Lafayette');
  const [locationPoint, setLocationPoint] = useState({ longitude: -86.9147, latitude: 40.4259 });
  const mapRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.trim().length < 3) { setSuggestions([]); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const results = await Location.geocodeAsync(location);
        if (active) setSuggestions(results.slice(0, 5));
      } catch (error) {
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
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    } catch (error) {
      Alert.alert('Location not found', error.message);
    } finally { setGeocoding(false); }
  }

  async function pickMapLocation(event) {
    const point = event.nativeEvent.coordinate;
    setLocationPoint(point);
    mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    try {
      const [result] = await Location.reverseGeocodeAsync(point);
      const label = [result?.name, result?.street, result?.city].filter(Boolean).join(', ');
      if (label) setLocation(label);
    } catch (error) {
      // The coordinate is still valid if reverse geocoding is unavailable.
    }
  }

  function chooseSuggestion(result) {
    const label = [result.name, result.street, result.city, result.region].filter(Boolean).join(', ');
    setLocation(label || location);
    setLocationPoint({ latitude: result.latitude, longitude: result.longitude });
    mapRef.current?.animateToRegion({ latitude: result.latitude, longitude: result.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    setSuggestions([]);
  }

  async function create() {
    setLoading(true);
    try {
      const data = await graphql(MUTATION, {
        hostId: CURRENT_USER_ID,
          input: {
            sport,
          startsAt: startsAt.toISOString(),
          location,
          locationPoint,
          skillRange: '2.0-4.0',
          maxParticipants: 6,
        },
      });
      Alert.alert('Session created', `${data.createSession.sport} at ${data.createSession.location}`);
      navigation.navigate('Explore');
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
          <TextInput value={sport} onChangeText={setSport} placeholder="Pickleball" style={styles.input} />
          <Text style={styles.label}>Date</Text>
          <DateTimePicker value={startsAt} mode="date" onChange={(_, value) => value && setStartsAt(value)} display={Platform.OS === 'ios' ? 'inline' : 'default'} />
          <Text style={styles.label}>Time</Text>
          <DateTimePicker value={startsAt} mode="time" onChange={(_, value) => value && setStartsAt(value)} display={Platform.OS === 'ios' ? 'spinner' : 'default'} />
          <Text style={styles.label}>Location</Text>
          <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="Search for an address" />
          {suggestions.map((result, index) => <Text key={`${result.latitude}-${result.longitude}-${index}`} onPress={() => chooseSuggestion(result)} style={styles.suggestion}>
            {[result.name, result.street, result.city, result.region].filter(Boolean).join(', ')}
          </Text>)}
          <PrimaryButton label={geocoding ? 'Finding location...' : 'Find address'} onPress={findLocation} disabled={geocoding || !location.trim()} variant="secondary" />
          <MapView ref={mapRef} style={styles.pickerMap} initialRegion={{ ...locationPoint, latitudeDelta: 0.02, longitudeDelta: 0.02 }} onPress={pickMapLocation}>
            <Marker coordinate={locationPoint} />
          </MapView>
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
};
