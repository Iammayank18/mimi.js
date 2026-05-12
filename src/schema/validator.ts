import type { RouteSchema, RequestHandler, MimiRequest, MimiResponse, NextFunction } from '../types';

export function createValidator(schema: RouteSchema): RequestHandler {
  return async function validateRequest(
    req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (schema.params) req.params = schema.params.parse(req.params) as Record<string, string>;
      if (schema.query) req.query = schema.query.parse(req.query) as Record<string, string>;
      if (schema.headers) schema.headers.parse(req.headers);
      if (schema.body) req.body = schema.body.parse(req.body);
      next();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as any).issues)) {
        res.status(422).json({ error: 'Validation failed', issues: (err as any).issues });
      } else {
        next(err as Error);
      }
    }
  };
}
