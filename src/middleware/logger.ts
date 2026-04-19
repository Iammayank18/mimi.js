import winston from 'winston';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message }) => `${level}: ${message}`),
  ),
  transports: [new winston.transports.Console()],
});

export const requestLogger: RequestHandler = (
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
): void => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
  });
  next();
};
