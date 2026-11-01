import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Constants from 'expo-constants';
import { graphql } from '../../api';
import { GOOGLE_CLIENT_IDS } from '../../config';
import { screenAfterSignIn, startSession } from '../../session';

const MUTATION = `mutation GoogleSignIn($idToken: String!) {
  googleSignIn(idToken: $idToken) { success message userId token }
}`;

export default function GoogleSignInButton({ navigation, onError }) {
  const [loading, setLoading] = useState(false);
  // The native module and callback scheme are only present in a custom build.
  if (!GOOGLE_CLIENT_IDS.ios || !GOOGLE_CLIENT_IDS.web || Constants.executionEnvironment === 'storeClient') return null;

  async function signIn() {
    setLoading(true);
    onError(null);
    try {
      // Keep Expo Go usable when the native module is not linked.
      const { GoogleSignin, isSuccessResponse } = require('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ iosClientId: GOOGLE_CLIENT_IDS.ios, webClientId: GOOGLE_CLIENT_IDS.web });
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return;
      if (!result.data.idToken) throw new Error('Google did not return an identity token.');
      const data = await graphql(MUTATION, { idToken: result.data.idToken });
      if (!data.googleSignIn.success) throw new Error(data.googleSignIn.message || 'Google sign-in failed.');
      await startSession(data.googleSignIn);
      const next = await screenAfterSignIn();
      navigation.reset({ index: 0, routes: [{ name: next }] });
    } catch (error) {
      onError(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return <TouchableOpacity accessibilityRole="button" style={[styles.button, loading && styles.disabled]} onPress={signIn} disabled={loading}>
    {loading ? <ActivityIndicator color="#444" /> : <Text style={styles.text}>Continue with Google</Text>}
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#DADADA', marginTop: 16 },
  disabled: { opacity: 0.6 },
  text: { color: '#333', fontSize: 16, fontWeight: '600' },
});
