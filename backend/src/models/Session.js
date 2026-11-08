import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  startsAt: { type: Date, required: true },
  // The session counts as ended once this passes; there is no manual "complete"
  // step. Older sessions without one are treated as ending 2 hours after start.
  endsAt: { type: Date },
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
  skillMin: { type: Number },
  skillMax: { type: Number },
  // The host's required level: 1 beginner, 2 intermediate, 3 advanced. Older
  // sessions only have skillRange/skillMin/skillMax.
  skillLevel: { type: Number, min: 1, max: 3 },
  tags: { type: [String], default: [] },
  maxParticipants: { type: Number, default: 6 },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Who can find and join the session. Sessions stored before this field
  // existed have none and are treated as PUBLIC.
  visibility: { type: String, enum: ['PUBLIC', 'FRIENDS', 'INVITE_ONLY'], default: 'PUBLIC' },
  // People the host invited. Only used by INVITE_ONLY sessions.
  invitees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Stored status is not updated when a session ends; the resolvers derive
  // "completed" from endsAt. Sessions stored as completed with no endsAt
  // predate no-show reports and keep the old rating rules. "cancelled" is set
  // by the host and is final.
  status: { type: String, enum: ['upcoming', 'in_progress', 'completed', 'cancelled'], default: 'completed' },
  cancelledAt: { type: Date },
  // "Only show up if the session is full" (#375): unless every spot is taken
  // when joining closes (5 minutes before the start, #376),
  // the session doesn't happen and nobody is counted as a no-show.
  fullOnly: { type: Boolean, default: false },
  // Set once the players of a session that didn't go ahead (too few players,
  // or a full-only session that didn't fill) have been told.
  invalidNotifiedAt: { type: Date, default: null },
  // Location check-in was removed (#358): attendance always comes from the
  // peer no-show reports below. These fields are kept so stored data stays
  // readable, but nothing reads them any more.
  checkInRequired: { type: Boolean, default: false },
  checkIns: [{
    _id: false,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    checkedInAt: { type: Date, default: Date.now }
  }],
  // Players who have already been given the automatic no-show rating of 1, so
  // it is never applied twice. noShowRatingsSettled flips once attendance is
  // final and every rating owed has been applied.
  noShowRated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  noShowRatingsSettled: { type: Boolean, default: false },
  // After the session ends, each participant answers "who didn't show up?"
  // once. A player is a no-show when most of the others who answered say so.
  noShowReports: [{
    _id: false,
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    noShows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reportedAt: { type: Date, default: Date.now }
  }],
  // `ratedBy` tracks who has submitted ratings; `rated` flips to true once
  // every participant has (and is also true on older, pre-ratedBy sessions).
  ratedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

sessionSchema.index({ locationPoint: '2dsphere' });
sessionSchema.index({ sport: 1, startsAt: 1, status: 1 });
sessionSchema.index({ participants: 1, startsAt: 1 });
sessionSchema.index({ endsAt: 1 });
sessionSchema.index({ noShowRatingsSettled: 1, startsAt: 1 });
sessionSchema.index({ invitees: 1 });

export default mongoose.model('Session', sessionSchema);
