import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { graphql } from '../api';
import { CURRENT_USER_ID } from '../config';

const PURPLE = '#7C7EFF';
const LEVELS = [1, 2, 3, 4, 5];
const SUGGESTED_SPORTS = ['Pickleball', 'Tennis', 'Basketball', 'Soccer', 'Volleyball', 'Golf', 'Running'];
const LIMITS = { name: 50, bio: 300, hometown: 80, sport: 30, sportCount: 10 };

const QUERY = `
  query GetProfile($id: ID!) {
    getUser(id: $id) {
      id name bio hometown
      sportSkills { sport skillLevel }
    }
  }
`;

const MUTATION = `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id name bio hometown
      sportSkills { sport skillLevel }
    }
  }
`;

export default function EditProfileScreen({ navigation }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [hometown, setHometown] = useState('');
  const [skills, setSkills] = useState([]);
  const [newSport, setNewSport] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getUser } = await graphql(QUERY, { id: CURRENT_USER_ID });
      setName(getUser.name || '');
      setBio(getUser.bio || '');
      setHometown(getUser.hometown || '');
      setSkills(getUser.sportSkills.map(({ sport, skillLevel }) => ({
        sport,
        skillLevel: Math.min(5, Math.max(1, Math.round(skillLevel))),
      })));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    const unsubscribe = navigation.addListener('focus', load);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation, load]);

  const addSport = (sport) => {
    const trimmed = sport.trim();
    if (!trimmed) return;
    if (skills.length >= LIMITS.sportCount) {
      setError(`You can list at most ${LIMITS.sportCount} sports.`);
      return;
    }
    if (skills.some((s) => s.sport.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already on your list.`);
      return;
    }
    setSkills([...skills, { sport: trimmed, skillLevel: 3 }]);
    setNewSport('');
    setError(null);
  };

  const setLevel = (sport, skillLevel) =>
    setSkills(skills.map((s) => (s.sport === sport ? { ...s, skillLevel } : s)));

  const removeSport = (sport) => setSkills(skills.filter((s) => s.sport !== sport));

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await graphql(MUTATION, {
        input: { name, bio, hometown, sportSkills: skills },
      });
      navigation.navigate('Profile');
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={PURPLE} /></View>;
  }

  const unusedSuggestions = SUGGESTED_SPORTS.filter(
    (s) => !skills.some((k) => k.sport.toLowerCase() === s.toLowerCase())
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.backText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name or username</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(text) => { setName(text); setError(null); }}
          maxLength={LIMITS.name}
          placeholder="How should people see you?"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Hometown</Text>
        <TextInput
          style={styles.input}
          value={hometown}
          onChangeText={(text) => { setHometown(text); setError(null); }}
          maxLength={LIMITS.hometown}
          placeholder="e.g. West Lafayette, IN"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={(text) => { setBio(text); setError(null); }}
          maxLength={LIMITS.bio}
          multiline
          placeholder="Tell people a little about yourself"
          placeholderTextColor="#999"
        />
        <Text style={styles.counter}>{bio.length}/{LIMITS.bio}</Text>

        <Text style={styles.label}>Sports and skill levels</Text>
        <Text style={styles.hint}>1 = just starting out, 5 = very experienced</Text>
        {skills.map(({ sport, skillLevel }) => (
          <View key={sport} style={styles.skillCard}>
            <View style={styles.skillHeader}>
              <Text style={styles.skillSport}>{sport}</Text>
              <TouchableOpacity onPress={() => removeSport(sport)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.levelRow}>
              {LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelDot, skillLevel === level && styles.levelDotActive]}
                  onPress={() => setLevel(sport, level)}
                >
                  <Text style={[styles.levelText, skillLevel === level && styles.levelTextActive]}>{level}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {skills.length === 0 && <Text style={styles.hint}>No sports yet — add one below.</Text>}

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.addInput]}
            value={newSport}
            onChangeText={setNewSport}
            maxLength={LIMITS.sport}
            placeholder="Add a sport"
            placeholderTextColor="#999"
            onSubmitEditing={() => addSport(newSport)}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => addSport(newSport)}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.suggestions}>
          {unusedSuggestions.map((sport) => (
            <TouchableOpacity key={sport} style={styles.suggestionPill} onPress={() => addSport(sport)}>
              <Text style={styles.suggestionText}>+ {sport}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  backText: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  content: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '700', color: '#444', marginTop: 20, marginBottom: 6 },
  hint: { fontSize: 12, color: '#888', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0',
  },
  bioInput: { minHeight: 90, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 4 },
  skillCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  skillHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillSport: { fontSize: 16, fontWeight: '600', color: '#222' },
  removeText: { fontSize: 13, color: '#c00', fontWeight: '600' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  levelDot: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },
  levelDotActive: { backgroundColor: PURPLE },
  levelText: { fontSize: 16, fontWeight: '600', color: '#555' },
  levelTextActive: { color: '#fff' },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  addInput: { flex: 1 },
  addBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, marginLeft: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  suggestionPill: { backgroundColor: '#E8E8FF', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  suggestionText: { fontSize: 12, fontWeight: '600', color: '#3A2D80' },
  errorText: { color: '#c00', fontSize: 13, marginTop: 16 },
  saveBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
