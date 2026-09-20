import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { graphql } from '../../api';
import GoogleSignInButton from './GoogleSignInButton';

const PURPLE = '#7C7EFF';

const MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      success
      message
      userId
      requiresTwoFactor
    }
  }
`;

export default function LoginScreen({ route, navigation }) {
  // Set after a password reset, so the user knows to log in with the new one.
  const notice = route.params?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await graphql(MUTATION, { email: email.trim(), password });
      if (!data.login.success) {
        setError(data.login.message);
      } else {
        navigation.navigate('TwoFactor', { email: email.trim(), mode: 'login' });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Log In</Text>
        <Text style={styles.headerSubtitle}>Welcome back</Text>
      </View>
      <View style={styles.content}>
        {notice && <Text style={styles.noticeText}>{notice}</Text>}
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(text) => { setEmail(text); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(text) => { setPassword(text); setError(null); }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleLogin}
        />
        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
        >
          <Text style={styles.forgotLinkText}>Forgot your password?</Text>
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Log In</Text>}
        </TouchableOpacity>
        <GoogleSignInButton navigation={navigation} onError={setError} />
        <TouchableOpacity style={styles.signUpLink} onPress={() => navigation.navigate('SignUpEmail')}>
          <Text style={styles.signUpLinkText}>Don't have an account? <Text style={styles.signUpLinkBold}>Sign Up</Text></Text>
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
  forgotLink: { marginTop: 12, alignSelf: 'flex-end' },
  forgotLinkText: { color: PURPLE, fontSize: 13, fontWeight: '600' },
  errorText: { color: '#c00', fontSize: 13, marginTop: 10 },
  noticeText: { color: '#2DB55D', fontSize: 14, fontWeight: '600' },
  continueBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  signUpLink: { marginTop: 20, alignItems: 'center' },
  signUpLinkText: { color: '#666', fontSize: 14 },
  signUpLinkBold: { color: PURPLE, fontWeight: '700' },
});
