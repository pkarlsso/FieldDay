import mongoose from 'mongoose';

// A long-lived "stay signed in" login. Only the SHA-256 hash of the token is
// stored, so a database leak does not expose usable tokens.
const authSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
  // MongoDB removes the document automatically once this date passes.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
});

export default mongoose.model('AuthSession', authSessionSchema);
