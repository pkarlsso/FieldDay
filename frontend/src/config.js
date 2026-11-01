// The signed-in user's ID, set at sign-in and cleared at sign-out. Screens use
// it only to tell which rows are "you" (host badge, your own player row). It is
// never sent as proof of who you are: the server works that out from the
// session token in the Authorization header.
export let CURRENT_USER_ID = null;

// The shared AWS API is the normal backend for Expo development and installed
// builds. Set EXPO_PUBLIC_API_URL locally only when intentionally testing a
// backend running on your own machine.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://sgbtn5pq84.execute-api.us-east-2.amazonaws.com/graphql';

// Live session updates (Socket.IO) come from the same server as GraphQL, so
// by default this is API_URL without the /graphql path.
export const REALTIME_URL =
  process.env.EXPO_PUBLIC_REALTIME_URL ||
  API_URL.replace(/\/graphql\/?$/, '');

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
