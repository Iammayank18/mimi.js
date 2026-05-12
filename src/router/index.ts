import FindMyWay from 'find-my-way';
import { Layer } from './layer';
import { Route } from './route';
import type {
  MimiRequest,
  MimiResponse,
  NextFunction,
  Middleware,
  Route as IRoute,
} from '../types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'] as const;
const ALL_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export class Router {
  stack: Layer[] = [];
  private trie = FindMyWay({ ignoreTrailingSlash: true });
  private _routeMap = new Map<string, Route>();

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
    const trie = this.trie;
    let route = this._routeMap.get(path);
    if (!route) {
      route = new Route(path);
      this._routeMap.set(path, route);
      ALL_HTTP_METHODS.forEach((method) => {
        trie.on(method, path, route!.dispatch as any);
      });

      // Push a route layer so this route is checked in registration order,
      // not after all middleware — matching Express's interleaved stack behavior.
      const routeLayer = new Layer(path, { end: true, strict: false }, (req, res, next) => {
        const method = (req.method ?? 'GET') as FindMyWay.HTTPMethod;
        const found = trie.find(method, req.path ?? '/');
        if (found) {
          req.params = { ...req.params, ...(found.params as Record<string, string>) };
          (found.handler as any)(req, res, next);
        } else {
          next();
        }
      });
      routeLayer.route = route as any;
      this.stack.push(routeLayer);
    }
    return route as unknown as IRoute;
  }

  handle(req: MimiRequest, res: MimiResponse, done: NextFunction): void {
    (req as any).res = res;
    (res as any).req = req;
    let idx = 0;
    const stack = this.stack;
    const originalUrl = req.url ?? '/';

    function next(err?: Error | string): void {
      const layer = stack[idx++];

      if (!layer) {
        return done(err as Error | undefined);
      }

      const path = req.path ?? '/';
      if (!layer.match(path)) return next(err);

      // For use() middleware: strip the mount prefix from req.url
      if (layer.path !== undefined && layer.path !== '/') {
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

export interface Router {
  get(path: string, ...handlers: Middleware[]): this;
  post(path: string, ...handlers: Middleware[]): this;
  put(path: string, ...handlers: Middleware[]): this;
  patch(path: string, ...handlers: Middleware[]): this;
  delete(path: string, ...handlers: Middleware[]): this;
  head(path: string, ...handlers: Middleware[]): this;
  options(path: string, ...handlers: Middleware[]): this;
  all(path: string, ...handlers: Middleware[]): this;
}
