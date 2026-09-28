import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { CommonActions, usePreventRemove } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { graphql } from '../api';
import { CURRENT_USER_ID } from '../config';
import { Avatar, Card, IconButton, Pill, PrimaryButton, ScreenHeader, SportIcon } from '../fieldday/components/ui';
import { colors } from '../fieldday/theme';

const LEVELS = [1, 2, 3, 4, 5];
const SUGGESTED_SPORTS = ['Pickleball', 'Tennis', 'Basketball', 'Soccer', 'Volleyball', 'Golf', 'Running'];
const LIMITS = { name: 50, bio: 300, hometown: 80, sport: 30, sportCount: 10 };
// Pictures are cropped square and shrunk to this size before upload so they
// stay well under the server's size limit.
const PICTURE_SIZE = 256;

const QUERY = `
  query GetProfile($id: ID!) {
    getUser(id: $id) {
      id name bio hometown profilePicture
      sportSkills { sport skillLevel }
    }
  }
`;

const MUTATION = `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id name bio hometown profilePicture
      sportSkills { sport skillLevel }
    }
  }
`;

export default function EditProfileScreen({ navigation }) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [hometown, setHometown] = useState('');
  const [skills, setSkills] = useState([]);
  const [profilePicture, setProfilePicture] = useState('');
  const [newSport, setNewSport] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // The profile as last loaded or saved, to tell whether there are unsaved edits.
  const [original, setOriginal] = useState(null);
  // The navigation action held back while the unsaved-changes popup is open.
  const [blockedAction, setBlockedAction] = useState(null);
  // Set once leaving is confirmed; the effect below then performs the action.
  const [leaveAction, setLeaveAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getUser } = await graphql(QUERY, { id: CURRENT_USER_ID });
      const loaded = {
        name: getUser.name || '',
        bio: getUser.bio || '',
        hometown: getUser.hometown || '',
        profilePicture: getUser.profilePicture || '',
        skills: getUser.sportSkills.map(({ sport, skillLevel }) => ({
          sport,
          skillLevel: Math.min(5, Math.max(1, Math.round(skillLevel))),
        })),
      };
      setName(loaded.name);
      setBio(loaded.bio);
      setHometown(loaded.hometown);
      setProfilePicture(loaded.profilePicture);
      setSkills(loaded.skills);
      setOriginal(loaded);
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

  const pictureChanged = original !== null && profilePicture !== original.profilePicture;
  const hasUnsavedChanges = original !== null && !leaveAction && (
    name !== original.name
    || bio !== original.bio
    || hometown !== original.hometown
    || pictureChanged
    || JSON.stringify(skills) !== JSON.stringify(original.skills)
  );

  // Catches every way out (back arrow, Cancel, swipe, Android back, browser
  // back) and asks before throwing edits away.
  usePreventRemove(hasUnsavedChanges, ({ data }) => setBlockedAction(data.action));

  useEffect(() => {
    if (leaveAction) navigation.dispatch(leaveAction);
  }, [leaveAction, navigation]);

  // A browser refresh or tab close skips navigation, so fall back to the
  // browser's own "Leave site?" prompt on web.
  useEffect(() => {
    if (Platform.OS !== 'web' || !hasUnsavedChanges) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

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

  const choosePicture = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    try {
      const { uri, width, height } = result.assets[0];
      const context = ImageManipulator.manipulate(uri);
      // allowsEditing already crops square on iOS/Android; web skips the editor.
      if (width && height && width !== height) {
        const side = Math.min(width, height);
        context.crop({
          originX: Math.floor((width - side) / 2),
          originY: Math.floor((height - side) / 2),
          width: side,
          height: side,
        });
      }
      context.resize({ width: PICTURE_SIZE, height: PICTURE_SIZE });
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
      setProfilePicture(`data:image/jpeg;base64,${saved.base64}`);
    } catch (err) {
      console.log('Profile picture error:', err.message);
      setError('Could not use that photo. Try a different one.');
    }
  };

  const removePicture = () => {
    setProfilePicture('');
    setError(null);
  };

  // Saves the profile and then performs `then` (a navigation action) on success.
  const handleSave = async (then = CommonActions.goBack()) => {
    setBlockedAction(null);
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const input = { name, bio, hometown, sportSkills: skills };
      // Only upload the picture when it changed, since it is the bulk of the request.
      if (pictureChanged) input.profilePicture = profilePicture;
      await graphql(MUTATION, { input });
      setLeaveAction(then);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const discardAndLeave = () => {
    setLeaveAction(blockedAction);
    setBlockedAction(null);
  };

  const header = (
    <ScreenHeader
      title="Edit Profile"
      left={<IconButton icon="chevron-back" onPress={() => navigation.goBack()} />}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ActivityIndicator size="large" color={colors.purple} style={{ marginTop: 40 }} />
      </View>
    );
  }

  const unusedSuggestions = SUGGESTED_SPORTS.filter(
    (s) => !skills.some((k) => k.sport.toLowerCase() === s.toLowerCase())
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.pictureCard}>
          <Avatar name={name || '?'} uri={profilePicture} color={colors.purple} size={96} />
          <View style={styles.pictureActions}>
            <Pill label={profilePicture ? 'Change photo' : 'Add photo'} active onPress={choosePicture} />
            {profilePicture ? <Pill label="Remove" onPress={removePicture} /> : null}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>About you</Text>
          <Text style={styles.label}>Name or username</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => { setName(text); setError(null); }}
            maxLength={LIMITS.name}
            placeholder="How should people see you?"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Hometown</Text>
          <TextInput
            style={styles.input}
            value={hometown}
            onChangeText={(text) => { setHometown(text); setError(null); }}
            maxLength={LIMITS.hometown}
            placeholder="e.g. West Lafayette, IN"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={(text) => { setBio(text); setError(null); }}
            maxLength={LIMITS.bio}
            multiline
            placeholder="Tell people a little about yourself"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.counter}>{bio.length}/{LIMITS.bio}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Sports preferences</Text>
          <Text style={styles.hint}>Skill level: 1 = just starting out, 5 = very experienced</Text>
          <View style={{ gap: 10 }}>
            {skills.map(({ sport, skillLevel }) => (
              <View key={sport} style={styles.skillCard}>
                <View style={styles.skillHeader}>
                  <SportIcon sport={sport} size={40} />
                  <Text style={styles.skillSport}>{sport}</Text>
                  <TouchableOpacity onPress={() => removeSport(sport)} hitSlop={8}>
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
          </View>
          {skills.length === 0 && <Text style={styles.hint}>No sports yet. Add one below.</Text>}

          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, styles.addInput]}
              value={newSport}
              onChangeText={setNewSport}
              maxLength={LIMITS.sport}
              placeholder="Add a sport"
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => addSport(newSport)}
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => addSport(newSport)}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {unusedSuggestions.length > 0 && (
            <View style={styles.suggestions}>
              {unusedSuggestions.map((sport) => (
                <Pill key={sport} label={`+ ${sport}`} onPress={() => addSport(sport)} />
              ))}
            </View>
          )}
        </Card>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {saving
          ? <ActivityIndicator color={colors.purple} style={{ paddingVertical: 15 }} />
          : <PrimaryButton label="Save Changes" icon="checkmark-circle-outline" onPress={() => handleSave()} />}
        <PrimaryButton label="Cancel" variant="secondary" onPress={() => navigation.goBack()} disabled={saving} />
      </ScrollView>

      <Modal visible={!!blockedAction} transparent animationType="fade" onRequestClose={() => setBlockedAction(null)}>
        <View style={styles.backdrop}>
          <Card style={styles.dialog}>
            <Text style={styles.dialogTitle}>Save your changes?</Text>
            <Text style={styles.dialogBody}>You have unsaved changes to your profile. Would you like to save them before leaving?</Text>
            <View style={styles.dialogActions}>
              <PrimaryButton label="Save" icon="checkmark-circle-outline" onPress={() => handleSave(blockedAction)} />
              <PrimaryButton label="Discard changes" variant="destructive" onPress={discardAndLeave} />
              <TouchableOpacity onPress={() => setBlockedAction(null)} style={styles.keepEditing}>
                <Text style={styles.keepEditingText}>Keep editing</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  content: { padding: 18, paddingBottom: 60, gap: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(22, 23, 29, 0.45)', justifyContent: 'center', padding: 24 },
  dialog: { maxWidth: 420, width: '100%', alignSelf: 'center', padding: 20 },
  dialogTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  dialogBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  dialogActions: { gap: 10, marginTop: 18 },
  keepEditing: { alignItems: 'center', paddingVertical: 10 },
  keepEditingText: { color: colors.purple, fontWeight: '900', fontSize: 15 },
  pictureCard: { alignItems: 'center', paddingVertical: 22 },
  pictureActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 10 },
  input: {
    backgroundColor: colors.page, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: colors.ink, borderWidth: 1, borderColor: colors.line,
  },
  bioInput: { minHeight: 90, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: colors.muted, textAlign: 'right', marginTop: 4 },
  skillCard: { backgroundColor: colors.purpleSoft, borderRadius: 16, padding: 12 },
  skillHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skillSport: { flex: 1, fontSize: 16, fontWeight: '900', color: colors.ink },
  removeText: { fontSize: 13, color: colors.coral, fontWeight: '800' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  levelDot: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center',
  },
  levelDotActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  levelText: { fontSize: 16, fontWeight: '800', color: colors.text },
  levelTextActive: { color: colors.card },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  addInput: { flex: 1 },
  addBtn: { backgroundColor: colors.purple, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13 },
  addBtnText: { color: colors.card, fontWeight: '900', fontSize: 15 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  errorText: { color: colors.coral, fontSize: 13, fontWeight: '700' },
});
