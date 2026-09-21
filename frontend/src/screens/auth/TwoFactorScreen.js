import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { graphql } from '../../api';
import { startSession } from '../../session';

const PURPLE = '#7C7EFF';

const VERIFY_MUTATION = `
  mutation VerifyTwoFactorCode($email: String!, $code: String!) {
    verifyTwoFactorCode(email: $email, code: $code) {
      success
      message
      userId
      token
    }
  }
`;

const RESEND_MUTATION = `
  mutation ResendTwoFactorCode($email: String!) {
    resendTwoFactorCode(email: $email) {
      success
      message
    }
  }
`;

export default function TwoFactorScreen({ route, navigation }) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await graphql(VERIFY_MUTATION, { email, code });
      if (!data.verifyTwoFactorCode.success) {
        setError(data.verifyTwoFactorCode.message);
      } else {
        await startSession(data.verifyTwoFactorCode);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
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
      const data = await graphql(RESEND_MUTATION, { email });
      setInfo(data.resendTwoFactorCode.message);
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
        <Text style={styles.headerTitle}>Verify It&apos;s You</Text>
        <Text style={styles.headerSubtitle}>Enter the 6-digit code sent to {email}</Text>
      </View>
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="000000"
          placeholderTextColor="#999"
          value={code}
          onChangeText={(text) => { setCode(text.replace(/\D/g, '').slice(0, 6)); setError(null); }}
          keyboardType="number-pad"
          maxLength={6}
          onSubmitEditing={handleVerify}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        {info && <Text style={styles.infoText}>{info}</Text>}
        <TouchableOpacity
          style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueBtnText}>Verify</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.resendLink} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendLinkText}>{resending ? 'Sending...' : 'Resend email'}</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700',
    borderWidth: 1, borderColor: '#E0E0E0', marginTop: 24,
  },
  errorText: { color: '#c00', fontSize: 13, marginTop: 10, textAlign: 'center' },
  infoText: { color: '#2DB55D', fontSize: 13, marginTop: 10, textAlign: 'center' },
  continueBtn: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendLink: { marginTop: 20, alignItems: 'center' },
  resendLinkText: { color: PURPLE, fontSize: 14, fontWeight: '600' },
});
