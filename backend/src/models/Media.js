import mongoose from 'mongoose';

// An image a user uploaded (today only profile photos). Profiles store a
// reference to one of these rather than whatever string the client sent, so
// the server decides what the bytes are and who owns them.
const mediaSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['profile-photo'], required: true },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
  // Set on upload and cleared once a profile points at it, so photos that are
  // uploaded but never saved are removed by MongoDB automatically.
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } }
});

export default mongoose.model('Media', mediaSchema);
