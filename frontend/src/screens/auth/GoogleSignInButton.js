import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { graphql } from '../../api';
import { GOOGLE_CLIENT_IDS } from '../../config';
import { startSession } from '../../session';

// Lets the web sign-in popup hand its result back to the app.
WebBrowser.maybeCompleteAuthSession();

const MUTATION = `
  mutation GoogleSignIn($idToken: String!) {
    googleSignIn(idToken: $idToken) {
      success
      message
      userId
      token
    }
  }
`;

const clientIdForPlatform = Platform.select({
  ios: GOOGLE_CLIENT_IDS.ios,
  android: GOOGLE_CLIENT_IDS.android,
  default: GOOGLE_CLIENT_IDS.web,
});

function GoogleButton({ navigation, onError }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_CLIENT_IDS.web || undefined,
    iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
    androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      onError('Google sign-in failed. Please try again.');
      return;
    }
    if (response.type !== 'success') return;

    const idToken = response.params?.id_token;
    if (!idToken) {
      onError('Google did not return a sign-in token. Please try again.');
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await graphql(MUTATION, { idToken });
        if (!data.googleSignIn.success) {
          onError(data.googleSignIn.message);
        } else {
          await startSession(data.googleSignIn);
          if (active) navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
      } catch (err) {
        onError(err.message);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [response, navigation, onError]);

  return (
    <TouchableOpacity
      style={[styles.button, (!request || loading) && styles.buttonDisabled]}
      onPress={() => { onError(null); promptAsync(); }}
      disabled={!request || loading}
    >
      {loading ? <ActivityIndicator color="#444" /> : <Text style={styles.buttonText}>Continue with Google</Text>}
    </TouchableOpacity>
  );
}

// Renders nothing until a Google client ID is configured for this platform
// (see frontend/.env.example), so the app works without Google set up.
export default function GoogleSignInButton(props) {
  if (!clientIdForPlatform) return null;
  return <GoogleButton {...props} />;
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1, borderColor: '#DADADA', marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#333', fontSize: 16, fontWeight: '600' },
});
