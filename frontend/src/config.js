// Public prototype settings only; never put MongoDB credentials here.
// Override these in frontend/.env and restart Expo with --clear.
export let CURRENT_USER_ID =
  process.env.EXPO_PUBLIC_CURRENT_USER_ID || '69db4924fa3cb80a64df2953';

// Your machine's local IP — update if needed
// Run `ipconfig getifaddr en0` in terminal to find your IP
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.4.205:4000/graphql';

export function setCurrentUserId(id) {
  CURRENT_USER_ID = id;
}
