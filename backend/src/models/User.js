import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  bio: { type: String, default: '' },
  hometown: { type: String, default: '' },
  // The current profile photo, uploaded through uploadProfilePhoto.
  profilePhoto: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', default: null },
  // Older accounts stored their photo inline as a data URI. Read-only now: it
  // is shown until the user uploads a new photo or removes it.
  profilePicture: { type: String, default: '' },
  sports: [{ type: String }],
  sportSkills: [{
    _id: false,
    sport: { type: String, required: true },
    skillLevel: { type: Number, required: true, min: 1, max: 5 }
  }],
  skillLevel: { type: Number, min: 1, max: 5, default: 3 },
  // When the user is usually free to play, e.g. [{ day: 'SAT', periods: ['MORNING'] }].
  availability: [{
    _id: false,
    day: { type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], required: true },
    periods: [{ type: String, enum: ['MORNING', 'AFTERNOON', 'EVENING'] }]
  }],
  socialRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },

  // Auth
  passwordHash: { type: String, default: null },
  googleId: { type: String, unique: true, sparse: true },
  twoFactorCodeHash: { type: String, default: null },
  twoFactorCodeExpires: { type: Date, default: null },
  twoFactorAttempts: { type: Number, default: 0 },
  passwordResetCodeHash: { type: String, default: null },
  passwordResetCodeExpires: { type: Date, default: null },
  passwordResetAttempts: { type: Number, default: 0 }
});

export default mongoose.model('User', userSchema);
