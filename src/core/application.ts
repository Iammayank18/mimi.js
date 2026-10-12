import './request';
import './response';
import http from 'http';
import { Router } from '../router';
import { createFinalHandler } from './finalhandler';
import { createRegister } from '../plugins';
import loadRoutes from '../router-loader';
import { setupSwagger } from '../swagger';
import { logger, reconfigureLogger, requestLogger } from '../middleware/logger';
import type {
  MimiApp,
  MimiOptions,
  RequestHandler,
  Route,
  AppErrorHandler,
  MiddlewareArg,
} from '../types';

const DEFAULT_KEEP_ALIVE_TIMEOUT = 65_000; // just above nginx's 60 s default
let _processHandlersRegistered = false;

export function mimi(options?: MimiOptions): MimiApp {
  const router = new Router();
  let errorHandler: AppErrorHandler | undefined;
  const servers: http.Server[] = [];

  // Logger setup — reconfigure pretty/JSON and auto-register requestLogger if requested
  if (options?.logger) {
    const wantPretty =
      typeof options.logger === 'object' && options.logger.pretty !== undefined
        ? options.logger.pretty
        : process.env.NODE_ENV !== 'production';
    reconfigureLogger(wantPretty);
    router.use(requestLogger);
  }

  function app(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Expose the app instance on every request for Express-compatible middleware
    (req as any).app = mimiApp;
    router.handle(req as any, res as any, createFinalHandler(req, res, errorHandler));
  }

  const mimiApp = app as unknown as MimiApp;

  (mimiApp as any).use = function (path: string | MiddlewareArg, ...fns: MiddlewareArg[]): MimiApp {
    router.use(path as any, ...(fns as any[]));
    return mimiApp;
  };

  (mimiApp as any).route = function (path: string): Route {
    return router.route(path);
  };

  // Express-compatible app settings (used by third-party middleware like express-rate-limit)
  const _settings: Record<string, unknown> = {};
  (mimiApp as any).set = function (key: string, value: unknown): MimiApp {
    _settings[key] = value;
    return mimiApp;
  };

  const HTTP_METHODS = ['post', 'put', 'patch', 'delete', 'head', 'options', 'all'] as const;

  HTTP_METHODS.forEach((method) => {
    (mimiApp as any)[method] = function (path: string, ...handlers: RequestHandler[]): MimiApp {
      (router as any)[method](path, ...handlers);
      return mimiApp;
    };
  });

  // app.get is overloaded: settings getter when called with no handlers, route registration otherwise
  (mimiApp as any).get = function (path: string, ...handlers: RequestHandler[]): MimiApp | unknown {
    if (handlers.length === 0) {
      return _settings[path];
    }
    (router as any).get(path, ...handlers);
    return mimiApp;
  };

  (mimiApp as any).listen = function (port: number, callback?: () => void): http.Server {
    const server = http.createServer(app);

    // Keep-alive: must exceed the reverse-proxy timeout (nginx default 60 s)
    server.keepAliveTimeout = options?.keepAliveTimeout ?? DEFAULT_KEEP_ALIVE_TIMEOUT;
    // headersTimeout must be > keepAliveTimeout to avoid a race condition
    server.headersTimeout = (options?.keepAliveTimeout ?? DEFAULT_KEEP_ALIVE_TIMEOUT) + 1_000;

    // Per-request socket idle timeout
    if (options?.requestTimeout) {
      server.setTimeout(options.requestTimeout);
      server.on('timeout', (socket: import('net').Socket) => {
        socket.destroy();
      });
    }

    servers.push(server);
    return server.listen(port, callback);
  };

  (mimiApp as any).close = function (callback?: (err?: Error) => void): void {
    if (servers.length === 0) {
      callback?.();
      return;
    }
    let pending = servers.length;
    let firstErr: Error | undefined;
    for (const server of servers) {
      server.close((err) => {
        if (err) firstErr = err;
        if (--pending === 0) callback?.(firstErr);
      });
    }
    servers.length = 0;
  };

  (mimiApp as any).register = createRegister(mimiApp);

  (mimiApp as any).setErrorHandler = function (fn: AppErrorHandler): MimiApp {
    errorHandler = fn;
    return mimiApp;
  };

  // Wire process-level safety net (opt-out with processErrorHandlers: false)
  if (options?.processErrorHandlers !== false && !_processHandlersRegistered) {
    _processHandlersRegistered = true;
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error({ reason }, 'unhandledRejection — check for missing await or .catch()');
    });

    process.on('uncaughtException', (err: Error) => {
      logger.fatal({ err }, 'uncaughtException — process will exit');
      // Give the logger a tick to flush before exiting
      setImmediate(() => process.exit(1));
    });
  }

  // Auto-load routes from consumer's ./routes/ directory
  loadRoutes(mimiApp).catch(() => {
    // loadRoutes logs internally; don't crash the app
  });

  if (options?.docs) {
    setupSwagger(mimiApp, options.docs);
  }

  return mimiApp;
}
