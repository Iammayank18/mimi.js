import type { IncomingMessage, ServerResponse, Server } from 'http';

export type NextFunction = (err?: Error | string) => void;

export interface SwaggerContact {
  name?: string;
  url?: string;
  email?: string;
}

export interface SwaggerLicense {
  name: string;
  url?: string;
}

export type SecuritySchemeType = 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';

export interface SecurityScheme {
  type: SecuritySchemeType;
  /** For type "http": "bearer" | "basic" */
  scheme?: string;
  /** For bearer: "JWT", "Token", etc. */
  bearerFormat?: string;
  /** For type "apiKey": header | query | cookie */
  in?: 'header' | 'query' | 'cookie';
  /** For type "apiKey": the header/query param name */
  name?: string;
  description?: string;
}

export interface SwaggerOptions {
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: SwaggerContact;
    license?: SwaggerLicense;
  };
  servers?: Array<{ url: string; description?: string }>;
  /** Global security requirement applied to all operations */
  security?: Record<string, string[]>[];
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

export interface MimiOptions {
  docs?: SwaggerOptions;
}

export interface ZodSchema {
  parse(data: unknown): unknown;
  toJSONSchema(options?: Record<string, unknown>): Record<string, unknown>;
}

export interface RouteSchema {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  /** Per-route security requirements. Overrides global security for this operation. */
  security?: Record<string, string[]>[];
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
  response?: Record<number, ZodSchema>;
}

export interface CookieOptions {
  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
}

export interface SendFileOptions {
  root?: string;
  maxAge?: number | string;
  lastModified?: boolean;
  etag?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  headers?: Record<string, string>;
}

export interface MimiRequest extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  path: string;
  hostname: string;
  host: string;
  ip: string;
  ips: string[];
  protocol: string;
  secure: boolean;
  xhr: boolean;
  fresh: boolean;
  stale: boolean;
  subdomains: string[];
  get(name: string): string | undefined;
  header(name: string): string | undefined;
  is(type: string): string | false;
  accepts(): string[];
  accepts(type: string): string | false;
  accepts(types: string[]): string | false;
  acceptsEncodings(): string[];
  acceptsEncodings(encoding: string): string | false;
  acceptsEncodings(encodings: string[]): string | false;
  acceptsCharsets(): string[];
  acceptsCharsets(charset: string): string | false;
  acceptsCharsets(charsets: string[]): string | false;
  acceptsLanguages(): string[];
  acceptsLanguages(lang: string): string | false;
  acceptsLanguages(langs: string[]): string | false;
  range(
    size: number,
    options?: { combine?: boolean },
  ): -1 | -2 | (Array<{ start: number; end: number }> & { type: string }) | undefined;
  locals: Record<string, unknown>;
}

export interface MimiResponse extends ServerResponse {
  locals: Record<string, unknown>;
  status(code: number): this;
  set(field: string, value: string): this;
  set(obj: Record<string, string>): this;
  header(field: string, value: string): this;
  header(obj: Record<string, string>): this;
  get(field: string): string | undefined;
  type(contentType: string): this;
  contentType(contentType: string): this;
  json(obj: unknown): void;
  jsonp(obj: unknown): void;
  send(body: unknown): void;
  redirect(url: string, status?: number): void;
  sendStatus(code: number): void;
  sendFile(path: string, options?: SendFileOptions, callback?: (err?: Error) => void): void;
  download(
    path: string,
    filename?: string,
    options?: SendFileOptions,
    callback?: (err?: Error) => void,
  ): void;
  attachment(filename?: string): this;
  append(field: string, value: string | string[]): this;
  location(url: string): this;
  vary(field: string): this;
  links(links: Record<string, string>): this;
  cookie(name: string, value: string | Record<string, unknown>, options?: CookieOptions): this;
  clearCookie(name: string, options?: CookieOptions): this;
  format(obj: Record<string, () => void>): void;
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
  get(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  get(...handlers: RequestHandler[]): this;
  post(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  post(...handlers: RequestHandler[]): this;
  put(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  put(...handlers: RequestHandler[]): this;
  patch(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  patch(...handlers: RequestHandler[]): this;
  delete(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  delete(...handlers: RequestHandler[]): this;
  head(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  head(...handlers: RequestHandler[]): this;
  options(schema: RouteSchema, ...handlers: RequestHandler[]): this;
  options(...handlers: RequestHandler[]): this;
  all(schema: RouteSchema, ...handlers: RequestHandler[]): this;
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
  get(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  get(path: string, ...handlers: RequestHandler[]): this;
  post(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  post(path: string, ...handlers: RequestHandler[]): this;
  put(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  put(path: string, ...handlers: RequestHandler[]): this;
  patch(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  patch(path: string, ...handlers: RequestHandler[]): this;
  delete(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  delete(path: string, ...handlers: RequestHandler[]): this;
  head(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  head(path: string, ...handlers: RequestHandler[]): this;
  options(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
  options(path: string, ...handlers: RequestHandler[]): this;
  all(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): this;
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
