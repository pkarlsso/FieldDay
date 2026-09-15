const winston = require('winston');
const path = require('path');
const fs = require('fs');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ---------- Formats ----------

// Human-readable console format for development
const consoleDevFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${stack || message}${metaString}`;
  })
);

// Structured JSON console format for production
const consoleProdFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// File format (structured JSON)
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ---------- Configuration ----------

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// ---------- Transports ----------

const transports = [
  // Console transport
  new winston.transports.Console({
    format: isProduction ? consoleProdFormat : consoleDevFormat,
  }),

  // Error-only file transport
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5 MB
    maxFiles: 5,
  }),

  // Combined file transport (all levels)
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5 MB
    maxFiles: 5,
  }),
];

// ---------- Logger ----------

const logger = winston.createLogger({
  level,
  format: fileFormat, // default format for transports that don't specify one
  defaultMeta: { service: 'my-app' },
  transports,

  // Log uncaught exceptions to a dedicated file
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: fileFormat,
    }),
  ],

  // Log unhandled promise rejections to a dedicated file
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: fileFormat,
    }),
  ],

  exitOnError: false, // do not exit after logging an uncaught exception
});

module.exports = logger;