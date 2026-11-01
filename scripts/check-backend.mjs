import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { buildSchema, validateSchema } from 'graphql';
import typeDefs from '../backend/src/graphql/typeDefs.js';
import '../backend/src/models/User.js';
import '../backend/src/models/Session.js';

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkDirectory(path);
    else if (path.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
checkDirectory(fileURLToPath(new URL('../backend/src/', import.meta.url)));
const errors = validateSchema(buildSchema(typeDefs));
if (errors.length) throw new Error(errors.map(error => error.message).join('\n'));
process.stdout.write('Backend syntax, GraphQL schema, and model loading passed.\n');
