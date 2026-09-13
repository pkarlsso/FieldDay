import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { graphql } from '../../api';

const PURPLE = '#7C7EFF';
const GREEN = '#2DB55D';

const MUTATION = `
  mutation SignUp($email: String!, $password: String!) {
    signUp(email: $email, password: $password) {
      success
      message
      userId
      requiresTwoFactor
    }
  }
`;

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function SignUpPasswordScreen({ route, navigation }) {
  const { email } = route.params;
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const failedRules = RULES.filter((rule) => !rule.test(password));
  const isStrongEnough = failedRules.length === 0;

  const handleSubmit = async () => {
    if (!isStrongEnough) {
      setError('Password does not meet the requirements below.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await graphql(MUTATION, { email, password });
      if (!data.signUp.success) {
        setError(data.signUp.message);
      } else {
        navigation.navigate('TwoFactor', { email, mode: 'signup' });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSubtitle}>Choose a password</Text>
      </View>
      <View style={styles.content}>
        <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(text) => { setPassword(text); setError(null); }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.rules}>
          {RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <Text key={rule.key} style={[styles.ruleText, met && styles.ruleTextMet]}>
                {met ? '✓' : '•'} {rule.label}
              </Text>
            );
          })}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.continueBtn, (loading || !isStrongEnough) && styles.continueBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading || !isStrongEnough}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Create Account</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: PURPLE, paddingTop: 80, paddingBottom: 30, paddingHorizontal: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  content: { flex: 1, padding: 24 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 16,
  },
  inputDisabled: { color: '#888', backgroundColor: '#EEE' },
  rules: { marginTop: 16, paddingHorizontal: 4 },
  ruleText: { fontSize: 13, color: '#888', marginBottom: 4 },
  ruleTextMet: { color: GREEN },
  errorText: { color: '#c00', fontSize: 13, marginTop: 10 },
  continueBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
