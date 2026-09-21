import mongoose from 'mongoose';

const sessionRegistrationSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  registeredAt: { type: Date, default: Date.now, required: true }
});

sessionRegistrationSchema.index({ session: 1, user: 1, registeredAt: 1 });
sessionRegistrationSchema.index({ user: 1, registeredAt: 1 });

export default mongoose.model('SessionRegistration', sessionRegistrationSchema);