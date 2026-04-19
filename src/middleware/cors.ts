import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => string | false);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE';

export function cors(options: CorsOptions = {}): RequestHandler {
  return function corsMiddleware(
    req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): void {
    const requestOrigin = req.headers.origin ?? '*';

    let allowOrigin: string = '*';

    if (!options.origin || options.origin === '*') {
      allowOrigin = '*';
    } else if (typeof options.origin === 'string') {
      allowOrigin = options.origin;
    } else if (Array.isArray(options.origin)) {
      allowOrigin = options.origin.includes(requestOrigin) ? requestOrigin : '';
    } else if (typeof options.origin === 'function') {
      const result = options.origin(requestOrigin);
      allowOrigin = result !== false ? result : '';
    }

    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    }

    if (options.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (options.exposedHeaders?.length) {
      res.setHeader('Access-Control-Expose-Headers', options.exposedHeaders.join(','));
    }

    // Preflight
    if (req.method === 'OPTIONS') {
      res.setHeader(
        'Access-Control-Allow-Methods',
        options.methods?.join(',') ?? DEFAULT_METHODS,
      );

      const requestedHeaders = req.headers['access-control-request-headers'];
      if (requestedHeaders) {
        res.setHeader(
          'Access-Control-Allow-Headers',
          options.allowedHeaders?.join(',') ?? requestedHeaders,
        );
      }

      if (options.maxAge) {
        res.setHeader('Access-Control-Max-Age', String(options.maxAge));
      }

      res.statusCode = 204;
      res.setHeader('Content-Length', '0');
      res.end();
      return;
    }

    next();
  };
}
