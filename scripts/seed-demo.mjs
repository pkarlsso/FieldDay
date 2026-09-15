import mongoose from 'mongoose';
import User from '../backend/src/models/User.js';
import Session from '../backend/src/models/Session.js';
import { getConfig } from '../backend/src/config.js';

const demoUsers = [
  { name: 'Gabriel Ogbalor', email: 'gogbalor@purdue.edu', sports: ['Pickleball', 'Basketball'], skillLevel: 3.5 },
  { name: 'Josh Martinez', email: 'josh@example.com', sports: ['Pickleball', 'Tennis'], skillLevel: 3.5 },
  { name: 'Ethan Ottinger', email: 'ejotting@purdue.edu', sports: ['Pickleball', 'Basketball'], skillLevel: 3 }
];

async function seedDemo() {
  await mongoose.connect(getConfig().mongoUri);
  const users = [];
  for (const user of demoUsers) {
    users.push(await User.findOneAndUpdate(
      { email: user.email },
      { $setOnInsert: user },
      { upsert: true, new: true }
    ));
  }

  const host = users[0];
  const session = await Session.findOneAndUpdate(
    { host: host._id, location: 'Station 21 West Lafayette', sport: 'Pickleball' },
    {
      $setOnInsert: {
        sport: 'Pickleball',
        startsAt: new Date(Date.now() + 86400000),
        location: 'Station 21 West Lafayette',
        locationPoint: { type: 'Point', coordinates: [-86.9147, 40.4259] },
        skillRange: '3.0-4.0',
        maxParticipants: 6,
        participants: [host._id],
        host: host._id,
        status: 'upcoming',
        rated: false
      }
    },
    { upsert: true, new: true }
  );

  console.log(`Demo user ID: ${host._id}`);
  console.log(`Demo session ID: ${session._id}`);
  await mongoose.disconnect();
}

seedDemo().catch((error) => {
  console.error('Demo seed failed:', error.message);
  process.exitCode = 1;
});
