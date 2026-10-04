function write(level, message, error) {
  if (__DEV__ || level === 'warn' || level === 'error') {
    const details = error instanceof Error ? error.message : error;
    console[level](details === undefined ? message : `${message} ${details}`);
  }
}

export const logger = {
  debug: (message, error) => write('debug', message, error),
  info: (message, error) => write('info', message, error),
  warn: (message, error) => write('warn', message, error),
  error: (message, error) => write('error', message, error),
};

export default logger;