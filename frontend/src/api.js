import { API_URL } from './config';
import { getAuthToken } from './authToken';
import logger from './logger';

export async function graphql(query, variables = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`GraphQL request failed with HTTP ${res.status}`);
    if (json.errors) {
      // Keep the server's error code (e.g. ACCOUNT_COOLDOWN) so screens can react to it.
      const [first] = json.errors;
      throw Object.assign(new Error(first.message), { code: first.extensions?.code, extensions: first.extensions || {} });
    }
    return json.data;
  } catch (error) {
    logger.error('GraphQL request failed', error);
    throw error;
  }
}
