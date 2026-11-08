import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { getConfig } from '../src/config.js';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import Rating from '../src/models/Rating.js';
import { buildShapedTables } from '../src/services/shapedExport.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = path.resolve(process.argv[2] || path.join(root, 'output', 'shaped'));

async function writeJsonLines(name, rows) {
  const payload = rows.map((row) => JSON.stringify(row)).join('\n');
  await fs.writeFile(path.join(outputDirectory, `${name}.jsonl`), payload ? `${payload}\n` : '', 'utf8');
}

try {
  const { mongoUri } = getConfig();
  await mongoose.connect(mongoUri);

  const [users, sessions, ratings] = await Promise.all([
    User.find({}).lean(),
    Session.find({}).lean(),
    Rating.find({}).lean()
  ]);
  const tables = buildShapedTables({ users, sessions, ratings });

  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all(Object.entries(tables).map(([name, rows]) => writeJsonLines(name, rows)));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${tables.users.length} users, ${tables.sessions.length} sessions, and ${tables.interactions.length} interactions to ${outputDirectory}`);
} finally {
  await mongoose.disconnect();
}
