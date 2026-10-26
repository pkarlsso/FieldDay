import { createHmac } from 'node:crypto';

const REQUEST_TIMEOUT_MS = 2500;

function gorseConfig(env = process.env) {
  const baseUrl = env.GORSE_BASE_URL?.trim();
  const apiKey = env.GORSE_API_KEY?.trim();
  const idSecret = env.GORSE_ID_SECRET?.trim();
  if (!baseUrl || !idSecret) return null;

  const url = new URL(baseUrl);
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocal) {
    throw new Error('GORSE_BASE_URL must use HTTPS unless it points to localhost.');
  }
  if (!isLocal && !apiKey) throw new Error('GORSE_API_KEY is required for non-local Gorse.');
  return { baseUrl: url.toString().replace(/\/$/, ''), apiKey, idSecret };
}

function gorseId(kind, rawId, secret) {
  return createHmac('sha256', secret)
    .update(`${kind}:${String(rawId)}`)
    .digest('hex');
}

function toGorseUser(user, secret) {
  const sports = (user.sportSkills?.length
    ? user.sportSkills.map(({ sport }) => sport)
    : user.sports || []);
  return {
    UserId: gorseId('user', user._id, secret),
    Labels: [...new Set(sports.map((sport) => String(sport).trim()).filter(Boolean))],
  };
}

function toGorseItem(session, secret) {
  const startsAt = session.startsAt ? new Date(session.startsAt) : null;
  return {
    ItemId: gorseId('session', session._id, secret),
    IsHidden: Boolean(session.__gorseHidden)
      || Boolean(startsAt && Number.isFinite(startsAt.getTime()) && startsAt <= new Date()),
    Categories: [...new Set([session.sport]
      .map((value) => String(value || '').trim())
      .filter(Boolean))],
    Labels: {
      skillLevel: Number(session.skillLevel || 0),
      startsAt: startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toISOString() : '',
      visibility: session.visibility || 'PUBLIC',
    },
    Timestamp: session.createdAt || new Date(),
  };
}

async function gorseRequest(path, { method = 'GET', body, config = gorseConfig() } = {}) {
  if (!config) throw new Error('Gorse is not configured.');
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const error = new Error(`Gorse request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function bestEffort(task) {
  try {
    await task();
  } catch (error) {
    // Gorse is an optional ranking provider. MongoDB remains the source of truth.
    console.warn(`Gorse sync skipped: ${error.message}`);
  }
}

async function syncUser(user) {
  const config = gorseConfig();
  if (!config) return;
  const record = toGorseUser(user, config.idSecret);
  try {
    await gorseRequest(`/api/user/${encodeURIComponent(record.UserId)}`, { config });
    await gorseRequest(`/api/user/${encodeURIComponent(record.UserId)}`, {
      method: 'PATCH',
      body: { Labels: record.Labels },
      config,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
    await gorseRequest('/api/user', { method: 'POST', body: record, config });
  }
}

async function syncItems(sessions) {
  const config = gorseConfig();
  if (!config || sessions.length === 0) return;
  const body = sessions.map((session) => toGorseItem(session, config.idSecret));
  await gorseRequest('/api/items', { method: 'POST', body, config });
}

async function recordJoin(user, session) {
  const config = gorseConfig();
  if (!config) return;
  const feedback = {
    FeedbackType: 'join',
    UserId: gorseId('user', user._id, config.idSecret),
    ItemId: gorseId('session', session._id, config.idSecret),
    Timestamp: new Date().toISOString(),
  };
  // A user/session pair contributes one join signal even if they leave and
  // rejoin; POST would accumulate duplicate feedback weights.
  await gorseRequest('/api/feedback', { method: 'PUT', body: [feedback], config });
}

async function recordRecommendationReads(user, sessions) {
  const config = gorseConfig();
  if (!config || sessions.length === 0) return;
  const userId = gorseId('user', user._id, config.idSecret);
  const feedback = sessions.map((session) => ({
    FeedbackType: 'read',
    UserId: userId,
    ItemId: gorseId('session', session._id, config.idSecret),
    Timestamp: new Date().toISOString(),
  }));
  // PUT makes an impression idempotent for a user/session pair instead of
  // inflating its weight every time Explore refreshes.
  await gorseRequest('/api/feedback', { method: 'PUT', body: feedback, config });
}

async function recommendedSessionIds(user, limit = 50) {
  const config = gorseConfig();
  if (!config) return null;
  const params = new URLSearchParams({ n: String(limit) });
  const sports = (user.sportSkills?.length
    ? user.sportSkills.map(({ sport }) => sport)
    : user.sports || []);
  for (const sport of new Set(sports.map((value) => String(value).trim()).filter(Boolean))) {
    params.append('category', sport);
  }
  const records = await gorseRequest(
    `/api/recommend/${encodeURIComponent(gorseId('user', user._id, config.idSecret))}?${params}`,
    { config },
  );
  return (Array.isArray(records) ? records : [])
    .map((record) => (typeof record === 'string' ? record : record?.Id))
    .filter(Boolean);
}

async function syncRecommendationsForUser(user, sessions) {
  const config = gorseConfig();
  if (!config) return;
  const record = toGorseUser(user, config.idSecret);
  try {
    await gorseRequest(`/api/user/${encodeURIComponent(record.UserId)}`, { config });
    await gorseRequest(`/api/user/${encodeURIComponent(record.UserId)}`, {
      method: 'PATCH',
      body: { Labels: record.Labels },
      config,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
    await gorseRequest('/api/user', { method: 'POST', body: record, config });
  }
  if (sessions.length) {
    await gorseRequest('/api/items', {
      method: 'POST',
      body: sessions.map((session) => toGorseItem(session, config.idSecret)),
      config,
    });
  }
}

async function syncFeedback(feedback) {
  const config = gorseConfig();
  if (!config || feedback.length === 0) return;
  await gorseRequest('/api/feedback', { method: 'PUT', body: feedback, config });
}

export {
  bestEffort,
  gorseConfig,
  gorseId,
  recommendedSessionIds,
  recordRecommendationReads,
  recordJoin,
  syncItems,
  syncFeedback,
  syncRecommendationsForUser,
  syncUser,
  toGorseItem,
  toGorseUser,
};
