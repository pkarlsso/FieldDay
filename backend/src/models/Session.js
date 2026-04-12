const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  location: { type: String, required: true },
  skillRange: { type: String, default: '3.0-4.0' },
  maxParticipants: { type: Number, default: 6 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['upcoming', 'in_progress', 'completed'], default: 'completed' },
  rated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
