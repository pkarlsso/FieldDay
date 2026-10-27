import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  target: {
    version: { type: Number, required: true, default: 1 },
    screen: { type: String, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
