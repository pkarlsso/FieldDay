const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  session: { type: Boolean, default: true },
  friends: { type: Boolean, default: true },
  ratings: { type: Boolean, default: true },
  chat: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
