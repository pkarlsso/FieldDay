// This will be updated after seeding the database with your actual user ID
export let CURRENT_USER_ID = '6aa5e41e7417dfc2247e78c6';

// Your machine's local IP — update if needed
// Run `ipconfig getifaddr en0` in terminal to find your IP
export const API_URL = 'http://10.0.0.19:4000/graphql';

export function setCurrentUserId(id) {
  CURRENT_USER_ID = id;
}
