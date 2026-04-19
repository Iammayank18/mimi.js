import send from 'send';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export interface StaticOptions {
  maxAge?: number | string;
  index?: string | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  lastModified?: boolean;
}

export function serveStatic(root: string, options: StaticOptions = {}): RequestHandler {
  return function staticMiddleware(
    req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const stream = send(req, req.path, { root, ...options });

    stream.on('error', (err: Error & { status?: number }) => {
      if (err.status === 404) {
        return next();
      }
      const error = new Error(err.message);
      (error as any).status = err.status ?? 500;
      next(error);
    });

    stream.on('directory', () => next());

    stream.pipe(res as any);
  };
}
