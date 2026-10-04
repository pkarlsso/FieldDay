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
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  } catch (error) {
    logger.error('GraphQL request failed', error);
    throw error;
  }
}
