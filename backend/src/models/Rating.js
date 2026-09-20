const mongoose = require('mongoose');

// One document per (session, rater, ratee). The unique index is what
// guarantees a player can only rate someone once for a given session, even if
// two submissions race each other.
const ratingSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  rater: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ratee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: { validator: Number.isInteger, message: 'value must be a whole number from 1 to 5' }
  },
  createdAt: { type: Date, default: Date.now }
});

ratingSchema.index({ session: 1, rater: 1, ratee: 1 }, { unique: true });
ratingSchema.index({ ratee: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', ratingSchema);
