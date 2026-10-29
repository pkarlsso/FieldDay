import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, maxlength: 2000 },
  clientMessageId: { type: String, required: true, maxlength: 100 },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
messageSchema.index({ conversation: 1, clientMessageId: 1 }, { unique: true });

export default mongoose.model('Message', messageSchema);