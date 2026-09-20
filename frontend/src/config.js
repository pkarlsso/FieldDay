// This will be updated after seeding the database with your actual user ID
export let CURRENT_USER_ID = '69db4924fa3cb80a64df2953';

// Your machine's local IP — update if needed
// Run `ipconfig getifaddr en0` in terminal to find your IP
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.4.205:4000/graphql';

// Google OAuth client IDs (public identifiers, not secrets). "Sign in with
// Google" only appears once the ID for the platform being run is set.
export const GOOGLE_CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};

export function setCurrentUserId(id) {
  CURRENT_USER_ID = id;
}
