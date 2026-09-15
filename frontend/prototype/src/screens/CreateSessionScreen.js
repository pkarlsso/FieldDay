import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { PrimaryButton, ScreenHeader, Card } from '../components/ui';
import { colors } from '../theme';
import { graphql, CURRENT_USER_ID } from '../../../src/api';

const MUTATION = `
  mutation CreateSession($hostId: ID!, $input: CreateSessionInput!) {
    createSession(hostId: $hostId, input: $input) { id sport startsAt location }
  }
`;

export default function CreateSessionScreen({ navigation }) {
  const [sport, setSport] = useState('Pickleball');
  const [startsAt, setStartsAt] = useState('2026-10-01T22:00:00.000Z');
  const [location, setLocation] = useState('Station 21 West Lafayette');
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      const data = await graphql(MUTATION, {
        hostId: CURRENT_USER_ID,
        input: {
          sport,
          startsAt,
          location,
          locationPoint: { longitude: -86.9147, latitude: 40.4259 },
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
          <Text style={styles.label}>Start time (ISO format)</Text>
          <TextInput value={startsAt} onChangeText={setStartsAt} style={styles.input} autoCapitalize="none" />
          <Text style={styles.label}>Location</Text>
          <TextInput value={location} onChangeText={setLocation} style={styles.input} />
          <PrimaryButton label={loading ? 'Creating...' : 'Create Session'} onPress={create} disabled={loading} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = {
  label: { color: colors.text, fontWeight: '800', marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.card, padding: 12, color: colors.ink },
};
