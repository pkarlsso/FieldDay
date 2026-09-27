const isDevelopment = process.env.NODE_ENV !== 'production';

function write(level, message, error) {
  const method = console[level] || console.log;
  if (isDevelopment || level === 'error') {
    method(`[FieldDay] ${message}`, error?.message || error || '');
  }
}

const logger = {
  debug: (message, error) => write('debug', message, error),
  info: (message, error) => write('info', message, error),
  warn: (message, error) => write('warn', message, error),
  error: (message, error) => write('error', message, error),
};

export default logger;
