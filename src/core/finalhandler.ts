import type { IncomingMessage, ServerResponse } from 'http';

export function createFinalHandler(
  req: IncomingMessage,
  res: ServerResponse,
): (err?: Error | string) => void {
  return function done(err?: Error | string): void {
    if (res.headersSent) return;

    if (err) {
      const error = typeof err === 'string' ? new Error(err) : err;
      const status = (error as any).status ?? (error as any).statusCode ?? 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const body = JSON.stringify({ error: error.message || 'Internal Server Error' });
      res.setHeader('Content-Length', Buffer.byteLength(body));
      try {
        res.end(body);
      } catch {
        // headers already sent — nothing we can do
      }
      return;
    }

    const msg = `Cannot ${req.method ?? 'GET'} ${req.url ?? '/'}`;
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(msg));
    try {
      res.end(msg);
    } catch {
      // headers already sent
    }
  };
}
