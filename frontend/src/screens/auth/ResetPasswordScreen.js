import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { graphql } from '../../api';
import PasswordChecklist, { isStrongPassword } from '../../components/PasswordChecklist';

const PURPLE = '#7C7EFF';

const RESET_MUTATION = `
  mutation ResetPassword($email: String!, $code: String!, $newPassword: String!) {
    resetPassword(email: $email, code: $code, newPassword: $newPassword) {
      success
      message
    }
  }
`;

const REQUEST_MUTATION = `
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      success
      message
    }
  }
`;

export default function ResetPasswordScreen({ route, navigation }) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleReset = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError('Password does not meet the requirements below.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await graphql(RESET_MUTATION, { email, code, newPassword: password });
      if (!data.resetPassword.success) {
        setError(data.resetPassword.message);
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Login', params: { notice: data.resetPassword.message } }] });
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await graphql(REQUEST_MUTATION, { email });
      setInfo('We sent a new code to your email.');
    } catch (err) {
      setError(err.message);
    }
    setResending(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <Text style={styles.headerSubtitle}>If {email} has an account, we sent it a 6-digit code</Text>
      </View>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="000000"
          placeholderTextColor="#999"
          value={code}
          onChangeText={(text) => { setCode(text.replace(/\D/g, '').slice(0, 6)); setError(null); }}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextInput
          style={styles.input}
          placeholder="New password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(text) => { setPassword(text); setError(null); }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#999"
          value={confirm}
          onChangeText={(text) => { setConfirm(text); setError(null); }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleReset}
        />
        <PasswordChecklist password={password} />
        {error && <Text style={styles.errorText}>{error}</Text>}
        {info && <Text style={styles.infoText}>{info}</Text>}
        <TouchableOpacity
          style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Reset Password</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.resendLink} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendLinkText}>{resending ? 'Sending...' : 'Send a new code'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: PURPLE, paddingTop: 60, paddingBottom: 30, paddingHorizontal: 24 },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  content: { flex: 1, padding: 24 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, borderWidth: 1, borderColor: '#E0E0E0', marginTop: 16,
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  errorText: { color: '#c00', fontSize: 13, marginTop: 10 },
  infoText: { color: '#2DB55D', fontSize: 13, marginTop: 10 },
  continueBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendLink: { marginTop: 20, marginBottom: 40, alignItems: 'center' },
  resendLinkText: { color: PURPLE, fontSize: 14, fontWeight: '600' },
});
