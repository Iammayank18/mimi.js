'use strict';
const morgan = require('morgan');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

const requestLogger = morgan('short', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
});

module.exports = { requestLogger, logger };
