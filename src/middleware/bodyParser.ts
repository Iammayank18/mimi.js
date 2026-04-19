import getRawBody from 'raw-body';
import qs from 'qs';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

const SKIP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface JsonOptions {
  limit?: string;
}

export interface UrlencodedOptions {
  extended?: boolean;
  limit?: string;
}

export function json(opts: JsonOptions = {}): RequestHandler {
  return async function jsonParser(
    req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): Promise<void> {
    if (SKIP_METHODS.has(req.method ?? '')) return next();
    if (!req.is('json')) return next();

    try {
      const raw = await getRawBody(req, {
        encoding: 'utf-8',
        limit: opts.limit ?? '1mb',
      });
      req.body = JSON.parse(raw as string);
      next();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as any).status = 400;
      next(error);
    }
  };
}

export function urlencoded(opts: UrlencodedOptions = {}): RequestHandler {
  return async function urlencodedParser(
    req: MimiRequest,
    res: MimiResponse,
    next: NextFunction,
  ): Promise<void> {
    if (SKIP_METHODS.has(req.method ?? '')) return next();
    if (!req.is('urlencoded')) return next();

    try {
      const raw = await getRawBody(req, {
        encoding: 'utf-8',
        limit: opts.limit ?? '1mb',
      });

      req.body =
        opts.extended === true
          ? qs.parse(raw as string)
          : Object.fromEntries(new URLSearchParams(raw as string));

      next();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as any).status = 400;
      next(error);
    }
  };
}
