import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getConfig() {
  const { MONGODB_URI, PORT = '4000' } = process.env;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy backend/.env.example to backend/.env and set the local development URI.');
  }
  return { mongoUri: MONGODB_URI, port: Number(PORT) };
}

export { getConfig };
