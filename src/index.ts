import 'dotenv/config';

export { mimi as default } from './core/application';
export { mimi } from './core/application';

export { setupSwagger } from './swagger';
export type { SwaggerOptions } from './swagger';

export { json, urlencoded, cors, security, serveStatic, requestLogger, customParser } from './middleware';
export type { JsonOptions, UrlencodedOptions, CorsOptions, SecurityOptions, StaticOptions } from './middleware';

export { logger } from './middleware/logger';

export { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware } from './auth';
export type { TokenPayload } from './auth';

export { Router } from './router';

export { mongodbManager } from './db/mongodb';
export { SQLiteManager } from './db/sqllite';

export type {
  MimiApp,
  MimiRequest,
  MimiResponse,
  RequestHandler,
  ErrorHandler,
  NextFunction,
  Middleware,
  Plugin,
  Route,
} from './types';
