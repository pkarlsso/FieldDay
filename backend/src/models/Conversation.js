const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  kind: { type: String, enum: ['session', 'direct'], required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  participantKey: { type: String, default: null },
  lastMessageAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ session: 1 }, { unique: true, partialFilterExpression: { session: { $type: 'objectId' } } });
conversationSchema.index({ participantKey: 1 }, { unique: true, partialFilterExpression: { kind: 'direct', participantKey: { $type: 'string' } } });

module.exports = mongoose.model('Conversation', conversationSchema);