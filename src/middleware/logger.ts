import pino from 'pino';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

const isDev = process.env.NODE_ENV !== 'production';

function buildTransport(pretty: boolean): pino.TransportSingleOptions | undefined {
  if (!pretty) return undefined;
  // pino resolves the transport target from process.cwd() (the consumer project),
  // so pino-pretty installed in the consumer's node_modules is always found.
  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: true,
      levelFirst: false,
    },
  };
}

/**
 * Shared pino logger instance.
 * - In development (NODE_ENV !== 'production'): uses pino-pretty if available, else JSON.
 * - In production: always JSON at info level.
 * Override the level with the LOG_LEVEL env var.
 */
function createPinoLogger(pretty: boolean): pino.Logger {
  const transport = buildTransport(pretty);
  try {
    return pino({
      level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
      ...(transport ? { transport } : {}),
    });
  } catch {
    // pino-pretty not installed — fall back to plain JSON
    return pino({ level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info') });
  }
}

let _logger = createPinoLogger(isDev);

/**
 * Shared pino logger. A Proxy over the internal instance so that
 * reconfigureLogger() can swap the underlying logger without consumers
 * needing to re-import.
 */
export const logger = new Proxy({} as pino.Logger, {
  get(_target, prop: string | symbol) {
    return (_logger as any)[prop as string];
  },
  apply(_target, _thisArg, args) {
    return (_logger as any)(...args);
  },
});

/**
 * Swap the underlying logger instance with a fresh one.
 * Called by application.ts when mimi({ logger: { pretty: ... } }) is set.
 */
export function reconfigureLogger(pretty: boolean): void {
  _logger = createPinoLogger(pretty);
}

/**
 * Middleware: logs every request/response pair as a structured JSON object.
 * Includes req.id when the requestId() middleware is upstream.
 * Level: error (5xx) · warn (4xx) · info (2xx–3xx).
 */
export const requestLogger: RequestHandler = (
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Math.round((Number(process.hrtime.bigint() - start) / 1e6) * 100) / 100;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger[level](
      { reqId: req.id, method: req.method, url: req.url, status, ms },
      `${req.method} ${req.url} → ${status} (${ms}ms)`,
    );
  });

  next();
};

/**
 * Log a structured error — use inside setErrorHandler or custom error middleware.
 * Never exposes the stack trace to clients; logs it server-side only.
 */
export function logError(err: Error, req: MimiRequest, statusCode: number): void {
  logger.error(
    {
      reqId: req.id,
      method: req.method,
      url: req.url,
      statusCode,
      err: {
        type: err.constructor?.name ?? 'Error',
        message: err.message,
        stack: err.stack,
      },
    },
    `${req.method} ${req.url} → ${statusCode}: ${err.message}`,
  );
}
