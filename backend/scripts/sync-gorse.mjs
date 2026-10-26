import mongoose from 'mongoose';
import { getConfig } from '../src/config.js';
import Rating from '../src/models/Rating.js';
import Session from '../src/models/Session.js';
import User from '../src/models/User.js';
import { gorseConfig, gorseId, syncFeedback, syncItems, syncUser } from '../src/services/gorse.js';

const BATCH_SIZE = 200;

function batches(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function main() {
  const { mongoUri } = getConfig();
  const config = gorseConfig();
  if (!config) throw new Error('Set GORSE_BASE_URL and GORSE_ID_SECRET before syncing data.');

  await mongoose.connect(mongoUri);
  try {
    const users = await User.find({}, '_id sports sportSkills skillLevel').lean();
    const sessions = await Session.find({}, '_id sport tags skillLevel startsAt createdAt visibility status endsAt maxParticipants')
      .lean();
    const sessionById = new Map(sessions.map((session) => [String(session._id), session]));

    for (const user of users) await syncUser(user);
    for (const batch of batches(sessions, BATCH_SIZE)) await syncItems(batch);

    // A submitted rating is evidence that the rater attended that session.
    // Membership alone is only intent to attend, so it is not backfilled.
    const ratings = await Rating.find({}, 'session rater createdAt').lean();
    const uniqueAttendance = new Map();
    for (const rating of ratings) {
      const session = sessionById.get(String(rating.session));
      if (!session || !rating.rater) continue;
      const key = `${rating.rater}:${rating.session}`;
      const existing = uniqueAttendance.get(key);
      if (!existing || new Date(rating.createdAt) < new Date(existing.Timestamp)) {
        uniqueAttendance.set(key, {
          FeedbackType: 'join',
          UserId: gorseId('user', rating.rater, config.idSecret),
          ItemId: gorseId('session', rating.session, config.idSecret),
          Timestamp: new Date(rating.createdAt || session.startsAt || session.createdAt).toISOString(),
        });
      }
    }
    const feedback = [...uniqueAttendance.values()];
    for (const batch of batches(feedback, BATCH_SIZE)) await syncFeedback(batch);
    console.log(`Gorse sync complete: ${users.length} users, ${sessions.length} sessions, ${feedback.length} attendance signals.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Gorse sync failed: ${error.message}`);
  process.exitCode = 1;
});
