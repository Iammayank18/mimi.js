import pino from 'pino';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export const requestLogger: RequestHandler = (
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
): void => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
};
