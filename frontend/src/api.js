const API_URL = 'http://192.168.4.205:4000/graphql';

export async function graphql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export const CURRENT_USER_ID = '69db4924fa3cb80a64df2953';
