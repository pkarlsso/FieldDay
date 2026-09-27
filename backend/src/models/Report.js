const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Ensure a user can only report another user once
reportSchema.index({ reporter: 1, reportedUser: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
