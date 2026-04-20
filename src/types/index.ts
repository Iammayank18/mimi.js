import type { IncomingMessage, ServerResponse, Server } from 'http';

export type NextFunction = (err?: Error | string) => void;

export interface MimiRequest extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  path: string;
  hostname: string;
  ip: string;
  locals: Record<string, unknown>;
  get(name: string): string | undefined;
  is(type: string): string | false;
}

export interface MimiResponse extends ServerResponse {
  locals: Record<string, unknown>;
  status(code: number): this;
  set(field: string, value: string): this;
  set(obj: Record<string, string>): this;
  type(contentType: string): this;
  json(obj: unknown): void;
  send(body: unknown): void;
  redirect(url: string, status?: number): void;
  sendStatus(code: number): void;
}

export type RequestHandler = (
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
) => void | Promise<void>;

export type ErrorHandler = (
  err: Error,
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
) => void;

export type Middleware = RequestHandler | ErrorHandler;

export interface LayerOptions {
  end?: boolean;
  strict?: boolean;
  sensitive?: boolean;
}

export interface Route {
  get(...handlers: RequestHandler[]): this;
  post(...handlers: RequestHandler[]): this;
  put(...handlers: RequestHandler[]): this;
  patch(...handlers: RequestHandler[]): this;
  delete(...handlers: RequestHandler[]): this;
  head(...handlers: RequestHandler[]): this;
  options(...handlers: RequestHandler[]): this;
  all(...handlers: RequestHandler[]): this;
}

export type Plugin = (app: MimiApp, options: Record<string, unknown>) => void | Promise<void>;

export type AppErrorHandler = (
  err: Error,
  req: MimiRequest,
  res: MimiResponse,
) => void | Promise<void>;

export interface MimiApp {
  use(path: string, ...handlers: Middleware[]): this;
  use(...handlers: Middleware[]): this;
  route(path: string): Route;
  get(path: string, ...handlers: RequestHandler[]): this;
  post(path: string, ...handlers: RequestHandler[]): this;
  put(path: string, ...handlers: RequestHandler[]): this;
  patch(path: string, ...handlers: RequestHandler[]): this;
  delete(path: string, ...handlers: RequestHandler[]): this;
  head(path: string, ...handlers: RequestHandler[]): this;
  options(path: string, ...handlers: RequestHandler[]): this;
  all(path: string, ...handlers: RequestHandler[]): this;
  listen(port: number, callback?: () => void): Server;
  register(plugin: Plugin, options?: Record<string, unknown>): this | Promise<this>;
  setErrorHandler(fn: AppErrorHandler): this;
}

// Module augmentation so Node's built-in types accept our added properties
declare module 'http' {
  interface IncomingMessage {
    params: Record<string, string>;
    query: Record<string, string>;
    body: unknown;
    locals: Record<string, unknown>;
  }
  interface ServerResponse {
    locals: Record<string, unknown>;
  }
}
