import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
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
const { buildSchema, validateSchema } = require('graphql');
const errors = validateSchema(buildSchema(require('./src/graphql/typeDefs.js')));
if (errors.length) throw new Error(errors.map(error => error.message).join('\n'));
require('./src/models/User.js');
require('./src/models/Session.js');
process.stdout.write('Backend syntax, GraphQL schema, and model loading passed.\n');
