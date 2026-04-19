import { Layer } from './layer';
import { Route } from './route';
import type { MimiRequest, MimiResponse, NextFunction, Middleware, Route as IRoute } from '../types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'] as const;

export class Router {
  stack: Layer[] = [];

  use(path: string | Middleware, ...fns: Middleware[]): this {
    let mountPath: string;
    let callbacks: Middleware[];

    if (typeof path === 'function') {
      mountPath = '/';
      callbacks = [path, ...fns];
    } else {
      mountPath = path;
      callbacks = fns;
    }

    callbacks.forEach((fn) => {
      const layer = new Layer(mountPath, { end: false, strict: false }, fn as any);
      layer.route = undefined;
      this.stack.push(layer);
    });

    return this;
  }

  route(path: string): IRoute {
    const route = new Route(path);
    const layer = new Layer(path, { end: true }, route.dispatch);
    layer.route = route;
    this.stack.push(layer);
    return route as unknown as IRoute;
  }

  handle(req: MimiRequest, res: MimiResponse, done: NextFunction): void {
    let idx = 0;
    const stack = this.stack;
    const originalUrl = req.url ?? '/';
    const originalPath = req.path;

    function next(err?: Error | string): void {
      const layer = stack[idx++];
      if (!layer) return done(err as Error | undefined);

      // Use the mutable url for matching prefix-stripped paths
      const path = req.path ?? '/';

      if (!layer.match(path)) return next(err);

      // Skip route layers whose HTTP method doesn't match
      if (layer.route && !layer.route._handles_method(req.method ?? 'GET')) {
        return next(err);
      }

      // Merge matched params
      req.params = { ...req.params, ...layer.params };

      // For use() middleware: strip the mount prefix from req.url
      if (!layer.route && layer.path !== undefined && layer.path !== '/') {
        const stripped = originalUrl.slice(layer.path.length) || '/';
        req.url = stripped;
      }

      if (err) {
        layer.handleError(err as Error, req, res, (e?: Error | string) => {
          req.url = originalUrl;
          next(e);
        });
      } else {
        layer.handleRequest(req, res, (e?: Error | string) => {
          req.url = originalUrl;
          next(e);
        });
      }
    }

    next();
  }
}

// Dynamically add HTTP method shortcuts to Router.prototype
HTTP_METHODS.forEach((method) => {
  (Router.prototype as any)[method] = function (path: string, ...handlers: Middleware[]) {
    const route = this.route(path);
    (route as any)[method](...handlers);
    return this;
  };
});
