import { randomUUID } from 'crypto';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

/**
 * Assigns a unique ID to every incoming request.
 * Reads `x-request-id` from the request headers first; generates a UUID v4 if absent.
 * The ID is echoed back via the `x-request-id` response header and stored on `req.id`.
 */
export function requestId(): RequestHandler {
  return function requestIdMiddleware(
    req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): void {
    const incoming = req.headers['x-request-id'] as string | undefined;
    const id = (incoming && /^[\w\-]{1,128}$/.test(incoming)) ? incoming : randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  };
}
