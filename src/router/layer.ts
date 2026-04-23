import { pathToRegexp, Key } from 'path-to-regexp';
import type { MimiRequest, MimiResponse, NextFunction, LayerOptions } from '../types';

type Handler = (...args: any[]) => any;

export class Layer {
  regexp: RegExp;
  keys: Key[] = [];
  handle: Handler;
  method?: string;
  route?: import('./route').Route;
  params: Record<string, string> = {};
  path?: string;

  private readonly fastSlash: boolean;
  private readonly fastStar: boolean;

  constructor(path: string, options: LayerOptions, fn: Handler) {
    this.handle = fn;
    this.keys = [];

    const opts = {
      end: options.end ?? true,
      strict: options.strict ?? false,
      sensitive: options.sensitive ?? false,
    };

    this.fastSlash = path === '/' && opts.end === false;
    this.fastStar = path === '*';

    this.regexp = pathToRegexp(path, this.keys, opts);
  }

  match(path: string): boolean {
    if (this.fastSlash) {
      this.params = {};
      this.path = '';
      return true;
    }

    if (this.fastStar) {
      this.params = { '0': decodeParam(path) };
      this.path = path;
      return true;
    }

    const match = this.regexp.exec(path);
    if (!match) {
      this.params = {};
      this.path = undefined;
      return false;
    }

    this.params = {};
    this.path = match[0];

    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[i];
      const prop = String(key.name);
      const val = match[i + 1];
      if (val !== undefined) {
        this.params[prop] = decodeParam(val);
      }
    }

    return true;
  }

  handleRequest(req: MimiRequest, res: MimiResponse, next: NextFunction): void {
    // Support Router instances passed directly to app.use()
    const fn =
      typeof this.handle !== 'function' && typeof (this.handle as any).handle === 'function'
        ? (this.handle as any).handle.bind(this.handle)
        : this.handle;

    if (fn.length > 3) {
      // error handler — skip in normal flow
      return next();
    }
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err as Error);
    }
  }

  handleError(err: Error, req: MimiRequest, res: MimiResponse, next: NextFunction): void {
    const fn = this.handle;
    if (fn.length !== 4) {
      return next(err);
    }
    try {
      fn(err, req, res, next);
    } catch (e) {
      next(e as Error);
    }
  }
}

function decodeParam(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}
