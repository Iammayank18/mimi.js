import type { IncomingMessage, ServerResponse } from 'http';
import type { MimiRequest, MimiResponse, AppErrorHandler } from '../types';
import { logError } from '../middleware/logger';

export function createFinalHandler(
  req: IncomingMessage,
  res: ServerResponse,
  errorHandler?: AppErrorHandler,
): (err?: Error | string) => void {
  return function done(err?: Error | string): void {
    if (res.headersSent) return;

    if (err) {
      const error = typeof err === 'string' ? new Error(err) : err;
      const rawStatus = (error as any).status ?? (error as any).statusCode ?? 500;
      const status =
        typeof rawStatus === 'number' && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 500;

      // Always log server errors; log client errors at warn level via logError
      logError(error, req as MimiRequest, status);

      if (errorHandler) {
        try {
          const result = errorHandler(error, req as MimiRequest, res as MimiResponse);
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(() => {
              if (!res.headersSent) sendDefaultError(res, error, status);
            });
          }
        } catch {
          if (!res.headersSent) sendDefaultError(res, error, status);
        }
        return;
      }

      sendDefaultError(res, error, status);
      return;
    }

    const msg = `Cannot ${req.method ?? 'GET'} ${req.url ?? '/'}`;
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(msg));
    try {
      res.end(msg);
    } catch {
      /* headers already sent */
    }
  };
}

function sendDefaultError(res: ServerResponse, error: Error, status: number): void {
  const isClientError = status >= 400 && status < 500;
  const message = isClientError ? error.message || 'Bad Request' : 'Internal Server Error';
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const body = JSON.stringify({ error: message });
  res.setHeader('Content-Length', Buffer.byteLength(body));
  try {
    res.end(body);
  } catch {
    /* headers already sent */
  }
}
