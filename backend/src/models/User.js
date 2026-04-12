const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  bio: { type: String, default: '' },
  sports: [{ type: String }],
  skillLevel: { type: Number, min: 1, max: 5, default: 3 },
  socialRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.methods.addRating = function (value) {
  this.totalRatings += 1;
  this.ratingSum += value;
  this.socialRating = Math.round((this.ratingSum / this.totalRatings) * 10) / 10;
};

module.exports = mongoose.model('User', userSchema);
