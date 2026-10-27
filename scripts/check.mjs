import { spawnSync } from 'node:child_process';
import process from 'node:process';

const checks = [
  ['Lint', ['run', 'lint']],
  ['Backend validation', ['run', 'check:backend']],
  ['Frontend build', ['run', 'build']],
];

for (const [name, args] of checks) {
  process.stdout.write(`\n==> ${name}\n`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.stdout.write('\nAll CI checks passed.\n');