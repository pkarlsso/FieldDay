const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getConfig() {
  const { MONGODB_URI, PORT = '4000' } = process.env;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy backend/.env.example to backend/.env and set the local development URI.');
  }
  return { mongoUri: MONGODB_URI, port: Number(PORT) };
}

module.exports = { getConfig };
