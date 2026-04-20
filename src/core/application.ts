import './request';
import './response';
import http from 'http';
import { Router } from '../router';
import { createFinalHandler } from './finalhandler';
import { createRegister } from '../plugins';
import loadRoutes from '../router-loader';
import type { MimiApp, Middleware, RequestHandler, Route, AppErrorHandler } from '../types';

export function mimi(): MimiApp {
  const router = new Router();
  let errorHandler: AppErrorHandler | undefined;

  function app(req: http.IncomingMessage, res: http.ServerResponse): void {
    router.handle(req as any, res as any, createFinalHandler(req, res, errorHandler));
  }

  const mimiApp = app as unknown as MimiApp;

  (mimiApp as any).use = function (path: string | Middleware, ...fns: Middleware[]): MimiApp {
    router.use(path as any, ...(fns as any[]));
    return mimiApp;
  };

  (mimiApp as any).route = function (path: string): Route {
    return router.route(path);
  };

  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'] as const;

  HTTP_METHODS.forEach((method) => {
    (mimiApp as any)[method] = function (path: string, ...handlers: RequestHandler[]): MimiApp {
      (router as any)[method](path, ...handlers);
      return mimiApp;
    };
  });

  (mimiApp as any).listen = function (port: number, callback?: () => void): http.Server {
    const server = http.createServer(app);
    return server.listen(port, callback);
  };

  (mimiApp as any).register = createRegister(mimiApp);

  (mimiApp as any).setErrorHandler = function (fn: AppErrorHandler): MimiApp {
    errorHandler = fn;
    return mimiApp;
  };

  // Auto-load routes from consumer's ./routes/ directory
  loadRoutes(mimiApp).catch(() => {
    // loadRoutes logs internally; don't crash the app
  });

  return mimiApp;
}
