import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { graphql } from '../../api';
import GoogleSignInButton from './GoogleSignInButton';

const PURPLE = '#7C7EFF';

const QUERY = `
  query CheckEmailExists($email: String!) {
    checkEmailExists(email: $email) {
      exists
      message
    }
  }
`;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignUpEmailScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await graphql(QUERY, { email: trimmed });
      if (data.checkEmailExists.exists) {
        setError(data.checkEmailExists.message);
      } else {
        navigation.navigate('SignUpPassword', { email: trimmed });
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
        <Text style={styles.headerSubtitle}>What&apos;s your email?</Text>
      </View>
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(text) => { setEmail(text); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onSubmitEditing={handleContinue}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Continue</Text>}
        </TouchableOpacity>
        <GoogleSignInButton navigation={navigation} onError={setError} />
        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkBold}>Log In</Text></Text>
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
    fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 24,
  },
  errorText: { color: '#c00', fontSize: 13, marginTop: 10 },
  continueBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { color: '#666', fontSize: 14 },
  loginLinkBold: { color: PURPLE, fontWeight: '700' },
});
