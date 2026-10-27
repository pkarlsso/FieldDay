const fs = require('node:fs');
const path = require('node:path');
const winston = require('winston');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;
const DEFAULT_LOG_DIR = path.join(__dirname, 'logs');

function createLogger({ logDir = process.env.LOG_DIR || DEFAULT_LOG_DIR, service = 'fieldday', silent = false } = {}) {
  fs.mkdirSync(logDir, { recursive: true });

  const isProduction = process.env.NODE_ENV === 'production';
  const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
  const consoleDevFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ level: entryLevel, message, timestamp: entryTimestamp, stack, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${entryTimestamp} ${entryLevel}: ${stack || message}${metaString}`;
    })
  );
  const structuredFormat = combine(timestamp(), errors({ stack: true }), json());
  const fileTransportOptions = { format: structuredFormat, maxsize: 5242880, maxFiles: 5 };

  return winston.createLogger({
    level,
    silent,
    format: structuredFormat,
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({ format: isProduction ? structuredFormat : consoleDevFormat }),
      new winston.transports.File({ ...fileTransportOptions, filename: path.join(logDir, 'error.log'), level: 'error' }),
      new winston.transports.File({ ...fileTransportOptions, filename: path.join(logDir, 'combined.log') }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ ...fileTransportOptions, filename: path.join(logDir, 'exceptions.log') }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ ...fileTransportOptions, filename: path.join(logDir, 'rejections.log') }),
    ],
    exitOnError: false,
  });
}

const logger = createLogger();
module.exports = logger;
module.exports.createLogger = createLogger;