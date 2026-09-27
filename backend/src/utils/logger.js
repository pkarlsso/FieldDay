let loggerPromise;

function getLogger() {
  loggerPromise ||= import('../../../logger.js').then(({ default: logger }) => logger);
  return loggerPromise;
}

function logError(message, error, meta = {}) {
  return getLogger()
    .then((logger) => logger.error(error instanceof Error ? error : message, {
      ...meta,
      ...(error instanceof Error ? { context: message } : {})
    }))
    .catch(() => undefined);
}

module.exports = { logError };
