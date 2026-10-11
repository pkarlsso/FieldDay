import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { graphql } from './api';
import { setCurrentUserId } from './config';
import { getAuthToken, setAuthToken } from './authToken';
import logger from './logger';

// Keeps the user signed in across app launches. The server issues a token that
// is good for 30 days (and renewed each time the app reopens); we store it in
// the device's secure storage — or localStorage on web, which has no secure store.
const STORAGE_KEY = 'fieldday.session';

async function readStored() {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(STORAGE_KEY)
      : await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logger.warn('Could not read stored session:', error);
    return null;
  }
}

async function writeStored(value) {
  try {
    if (Platform.OS === 'web') {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } else if (value) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(value));
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  } catch (err) {
    logger.warn('Could not update stored session:', err);
  }
}

const RESTORE_MUTATION = `
  mutation RestoreSession($token: String!) {
    restoreSession(token: $token) { success userId token }
  }
`;

const SETUP_QUERY = `
  query ProfileSetupStatus {
    me { id profileComplete }
  }
`;

const LOGOUT_MUTATION = `
  mutation Logout($token: String!) {
    logout(token: $token) { success }
  }
`;

// Call once a login (2FA or Google) succeeds.
export async function startSession({ userId, token }) {
  setAuthToken(token);
  setCurrentUserId(userId);
  await writeStored({ userId, token });
}

// Called at launch. Returns true if a saved login is still valid.
export async function restoreSession() {
  const stored = await readStored();
  if (!stored?.token) return false;

  try {
    const { restoreSession: result } = await graphql(RESTORE_MUTATION, { token: stored.token });
    if (result.success) {
      setAuthToken(stored.token);
      setCurrentUserId(result.userId);
      return true;
    }
    // The server says this login has expired or been revoked.
    await writeStored(null);
  } catch (err) {
    // Server unreachable: leave the saved login in place for the next launch.
    logger.warn('Could not restore session:', err);
  }
  return false;
}

// The first screen to show once signed in: first-run profile setup until the
// profile has everything it needs, then the main app.
export async function screenAfterSignIn() {
  try {
    const { me } = await graphql(SETUP_QUERY);
    return me && !me.profileComplete ? 'ProfileSetup' : 'MainTabs';
  } catch (err) {
    // Don't lock someone out of the app because this check failed.
    logger.warn('Could not check profile setup:', err);
    return 'MainTabs';
  }
}

// Call once a login (2FA, Google or demo) succeeds, then show the right screen.
export async function finishSignIn(navigation, result) {
  await startSession(result);
  navigation.reset({ index: 0, routes: [{ name: await screenAfterSignIn() }] });
}

export async function endSession() {
  const token = getAuthToken();
  setAuthToken(null);
  setCurrentUserId(null);
  await writeStored(null);
  if (token) {
    try {
      await graphql(LOGOUT_MUTATION, { token });
    } catch (err) {
      logger.warn('Logout request failed:', err);
    }
  }
}
