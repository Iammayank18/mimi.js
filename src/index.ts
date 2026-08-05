export { mimi as default } from './core/application';
export { mimi } from './core/application';

export { setupSwagger } from './swagger';
export type { SwaggerOptions } from './swagger';
export type { MimiOptions } from './types';

export {
  json,
  urlencoded,
  cors,
  security,
  serveStatic,
  requestLogger,
  requestId,
  logError,
  customParser,
} from './middleware';
export type {
  JsonOptions,
  UrlencodedOptions,
  CorsOptions,
  SecurityOptions,
  StaticOptions,
} from './middleware';

export { logger } from './middleware/logger';

export {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  invalidateToken,
  setTokenStore,
  authMiddleware,
} from './auth';
export type { TokenPayload, TokenStore } from './auth';

export { Router } from './router';
export { default as loadRoutes } from './router-loader';

export { mongodbManager } from './db/mongodb';
export { SQLiteManager } from './db/sqllite';

export { registry } from './schema';
export type { RouteRecord } from './schema';

export type {
  MimiApp,
  MimiRequest,
  MimiResponse,
  RequestHandler,
  ErrorHandler,
  AppErrorHandler,
  NextFunction,
  Middleware,
  MiddlewareArg,
  RouterLike,
  Plugin,
  Route,
  RouteSchema,
  ZodSchema,
} from './types';
