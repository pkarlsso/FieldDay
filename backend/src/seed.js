const mongoose = require('mongoose');
const User = require('./models/User');
const Session = require('./models/Session');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const users = [
  { name: 'Gabriel Ogbalor', email: 'gogbalor@purdue.edu', sports: ['Pickleball', 'Basketball'], skillLevel: 3.5, bio: 'Love pickup games!' },
  { name: 'Josh Martinez', email: 'josh@example.com', sports: ['Pickleball', 'Tennis'], skillLevel: 3.5, bio: 'Pickleball enthusiast' },
  { name: 'Jacob Thompson', email: 'jacob@example.com', sports: ['Pickleball', 'Soccer'], skillLevel: 3.5, bio: 'Always down for a game' },
  { name: 'Sarah Chen', email: 'sarah@example.com', sports: ['Pickleball', 'Volleyball'], skillLevel: 3.0, bio: 'New to pickleball!' },
  { name: 'Alex Williams', email: 'alex@example.com', sports: ['Basketball', 'Soccer'], skillLevel: 4.0, bio: 'Competitive player' },
  { name: 'Emma Davis', email: 'emma@example.com', sports: ['Tennis', 'Volleyball'], skillLevel: 2.5, bio: 'Casual weekend player' },
  { name: 'Ethan Ottinger', email: 'ejotting@purdue.edu', sports: ['Pickleball', 'Basketball'], skillLevel: 3.0, bio: 'FieldDay team member' },
  { name: 'Gustav Karlsson', email: 'pkarlsso@purdue.edu', sports: ['Soccer', 'Tennis'], skillLevel: 4.0, bio: 'FieldDay team member' },
  { name: 'Uma Srinivas', email: 'usriniva@purdue.edu', sports: ['Pickleball', 'Volleyball'], skillLevel: 3.5, bio: 'FieldDay team member' },
  { name: 'Mike Johnson', email: 'mike@example.com', sports: ['Basketball', 'Pickleball'], skillLevel: 2.0, bio: 'Just getting started' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  await User.deleteMany({});
  await Session.deleteMany({});
  console.log('Cleared existing data');

  const createdUsers = await User.insertMany(users);
  console.log(`Created ${createdUsers.length} users`);

  const gabriel = createdUsers[0];
  const josh = createdUsers[1];
  const jacob = createdUsers[2];
  const sarah = createdUsers[3];
  const alex = createdUsers[4];
  const emma = createdUsers[5];
  const ethan = createdUsers[6];

  const sessions = [
    {
      sport: 'Pickleball',
      date: 'Apr 12, 2026',
      time: '6:00 PM',
      location: 'Hildegard Park',
      skillRange: '3.0-4.0',
      maxParticipants: 4,
      participants: [gabriel._id, josh._id, jacob._id, sarah._id],
      host: josh._id,
      status: 'completed',
      rated: false
    },
    {
      sport: 'Basketball',
      date: 'Apr 10, 2026',
      time: '4:00 PM',
      location: 'Co-Rec Courts',
      skillRange: '2.5-4.0',
      maxParticipants: 6,
      participants: [gabriel._id, alex._id, ethan._id, emma._id],
      host: alex._id,
      status: 'completed',
      rated: false
    },
    {
      sport: 'Pickleball',
      date: 'Apr 8, 2026',
      time: '5:30 PM',
      location: 'Coyner Park',
      skillRange: '3.0-3.5',
      maxParticipants: 4,
      participants: [gabriel._id, jacob._id, sarah._id, emma._id],
      host: gabriel._id,
      status: 'completed',
      rated: false
    },
    {
      sport: 'Soccer',
      date: 'Apr 15, 2026',
      time: '3:00 PM',
      location: 'Slayter Hill Fields',
      skillRange: '2.0-4.0',
      maxParticipants: 10,
      participants: [gabriel._id, alex._id, ethan._id, jacob._id],
      host: ethan._id,
      status: 'upcoming',
      rated: false
    }
  ];

  const createdSessions = await Session.insertMany(sessions);
  console.log(`Created ${createdSessions.length} sessions`);

  console.log('\n--- Seed Complete ---');
  console.log(`Your user ID (Gabriel): ${gabriel._id}`);
  console.log('Use this ID in the frontend config.\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
