import fs from 'node:fs/promises';
import path from 'node:path';
import logger from './logger.js';

const marker = `logger-smoke-test-${Date.now()}`;
const logDir = path.resolve('logs');

logger.silly(`${marker} silly`);
logger.debug(`${marker} debug`);
logger.info(`${marker} info`, { userId: 42, ip: '127.0.0.1' });
logger.http(`${marker} http`);
logger.warn(`${marker} warning`);
logger.error(new Error(`${marker} error`));
logger.profile(marker);
logger.profile(marker);

await new Promise((resolve, reject) => {
  logger.on('finish', resolve);
  logger.on('error', reject);
  logger.end();
});

const [combinedLog, errorLog] = await Promise.all([
  fs.readFile(path.join(logDir, 'combined.log'), 'utf8'),
  fs.readFile(path.join(logDir, 'error.log'), 'utf8'),
]);

if (!combinedLog.includes(marker) || !errorLog.includes(marker)) {
  throw new Error('Logger smoke test did not write the expected log entries');
}

console.log('Logger smoke test passed');