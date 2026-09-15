const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  startsAt: { type: Date, required: true },
  location: { type: String, required: true },
  locationPoint: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => value.length === 2,
        message: 'locationPoint.coordinates must be [longitude, latitude]'
      }
    }
  },
  skillRange: { type: String, default: '3.0-4.0' },
  maxParticipants: { type: Number, default: 6 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['upcoming', 'in_progress', 'completed'], default: 'completed' },
  rated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

sessionSchema.index({ locationPoint: '2dsphere' });

module.exports = mongoose.model('Session', sessionSchema);
