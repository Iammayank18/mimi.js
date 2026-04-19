# mimijs Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four production-readiness gaps identified in the architecture analysis: URL allocation hot path, structured error handling, memory-heavy logger, and bloated core dependency bundle.

**Architecture:** Each task is independent and modifies a single concern. No task depends on another completing first. All changes are backward-compatible — no public API is removed. The existing v2.1 plan (radix router, hooks, validation, rate limiting) runs in parallel and is NOT duplicated here.

**Tech Stack:** TypeScript 5, vitest (test runner), pino (replaces winston), Node.js `http` module.

**Prerequisites:** Complete Task 1 of `docs/superpowers/plans/2026-04-19-mimijs-v2.1.md` (vitest infrastructure) before running tests in this plan. The `npm test` command must work before proceeding.

---

## File Map

| File | Change | Reason |
|------|--------|--------|
| `src/core/request.ts` | Modify — memoize URL parsing | Eliminates ~86k `URL` allocations/sec |
| `src/core/finalhandler.ts` | Modify — accept optional `errorHandler` param | Powers `setErrorHandler` |
| `src/core/application.ts` | Modify — add `setErrorHandler()`, pass handler to `createFinalHandler` | Public API for custom errors |
| `src/types/index.ts` | Modify — add `AppErrorHandler` type, `setErrorHandler` to `MimiApp` | TypeScript contract |
| `src/middleware/logger.ts` | Modify — replace winston with pino | −6 MB RSS, 7× faster |
| `src/index.ts` | Modify — export `AppErrorHandler` type | Public type for consumers |
| `package.json` | Modify — move mongoose/sequelize/sqlite3/bcrypt to peerDependencies, add pino | −20 MB RSS |
| `src/db/mongodb/index.ts` | Modify — lazy require with install hint | Graceful missing-peer error |
| `src/db/sqllite/index.ts` | Modify — lazy require with install hint | Graceful missing-peer error |
| `src/auth/authHelper.ts` | Modify — lazy require with install hint | Graceful missing-peer error |
| `tests/url-cache.test.ts` | Create | Covers Task 1 |
| `tests/error-handler.test.ts` | Create | Covers Task 2 |
| `tests/logger.test.ts` | Create | Covers Task 3 |
| `tests/peer-deps.test.ts` | Create | Covers Task 4 |

---

## Task 1: Memoize URL Parsing in `req.path` and `req.query`

**Problem:** `req.path` and `req.query` are property getters that call `new URL(this.url, 'http://x')` on every access. The Router reads `req.path` on every layer match — at 50 routes that's 26 URL constructor calls per request.

**Fix:** Parse once, cache the result on `_parsedUrl`. Both getters read from the same cached object.

**Files:**
- Modify: `src/core/request.ts`
- Create: `tests/url-cache.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/url-cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import http from 'http';
import net from 'net';
import '../src/core/request'; // side-effect: patches prototype

function makeReq(url: string): http.IncomingMessage {
  const req = new http.IncomingMessage(new net.Socket());
  req.url = url;
  return req;
}

describe('req.path and req.query — URL memoization', () => {
  it('req.path returns the pathname', () => {
    const req = makeReq('/users/42?page=2');
    expect((req as any).path).toBe('/users/42');
  });

  it('req.query returns query params as plain object', () => {
    const req = makeReq('/search?q=hello&limit=10');
    expect((req as any).query).toEqual({ q: 'hello', limit: '10' });
  });

  it('repeated access to req.path does NOT call URL constructor twice', () => {
    const req = makeReq('/products?sort=asc');
    const spy = vi.spyOn(global, 'URL');

    const p1 = (req as any).path;
    const p2 = (req as any).path;
    const q1 = (req as any).query;
    const q2 = (req as any).query;

    expect(p1).toBe('/products');
    expect(p2).toBe('/products');
    expect(q1).toEqual({ sort: 'asc' });
    expect(q2).toEqual({ sort: 'asc' });

    // URL constructed exactly once for the entire lifetime of this req object
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('handles malformed URL gracefully', () => {
    const req = makeReq('not-a-url');
    expect(() => (req as any).path).not.toThrow();
    expect((req as any).path).toBe('/');
    expect((req as any).query).toEqual({});
  });

  it('returns empty query for URL with no query string', () => {
    const req = makeReq('/about');
    expect((req as any).query).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/url-cache.test.ts
```

Expected: The third test (`repeated access`) fails — URL is currently called more than once.

- [ ] **Step 3: Rewrite `src/core/request.ts`**

Replace the full file with:

```typescript
import http from 'http';
import mimeTypes from 'mime-types';
import type { MimiRequest } from '../types';

const req = http.IncomingMessage.prototype as unknown as MimiRequest;

(req as any).params = {};
(req as any).body = undefined;
(req as any).locals = {};

req.get = function (this: MimiRequest, name: string): string | undefined {
  const lc = name.toLowerCase();
  if (lc === 'referrer' || lc === 'referer') {
    return (this.headers['referrer'] ?? this.headers['referer']) as string | undefined;
  }
  return this.headers[lc] as string | undefined;
};

function getParsedUrl(req: MimiRequest): { pathname: string; query: Record<string, string> } {
  if ((req as any)._parsedUrl) return (req as any)._parsedUrl;
  try {
    const u = new URL(req.url ?? '/', 'http://x');
    const query: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { query[k] = v; });
    (req as any)._parsedUrl = { pathname: u.pathname, query };
  } catch {
    (req as any)._parsedUrl = { pathname: '/', query: {} };
  }
  return (req as any)._parsedUrl;
}

Object.defineProperty(req, 'query', {
  get(this: MimiRequest): Record<string, string> {
    return getParsedUrl(this).query;
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'path', {
  get(this: MimiRequest): string {
    return getParsedUrl(this).pathname;
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'hostname', {
  get(this: MimiRequest): string {
    return (this.headers.host?.split(':')[0]) ?? '';
  },
  configurable: true,
  enumerable: true,
});

Object.defineProperty(req, 'ip', {
  get(this: MimiRequest): string {
    return this.socket?.remoteAddress ?? '';
  },
  configurable: true,
  enumerable: true,
});

req.is = function (this: MimiRequest, type: string): string | false {
  const contentType = this.headers['content-type'];
  if (!contentType) return false;
  const mimeType = mimeTypes.lookup(type);
  if (!mimeType) {
    return contentType.startsWith(type) ? type : false;
  }
  return contentType.startsWith(mimeType) ? mimeType : false;
};

export {};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/url-cache.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Build to confirm no TypeScript errors**

```bash
npm run build
```

Expected: exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/request.ts tests/url-cache.test.ts
git commit -m "perf(request): memoize URL parsing — one allocation per request instead of per-access"
```

---

## Task 2: `app.setErrorHandler(fn)`

**Problem:** There is no way for consumers to intercept errors before the generic 500 response is sent. Every production API needs to normalize error shapes, add correlation IDs, and differentiate 4xx from 5xx.

**Fix:** Add `setErrorHandler(fn)` to the `MimiApp` interface. The function receives `(err, req, res)` and is responsible for sending the response. If it throws or does not send a response, the default error handler takes over.

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/core/finalhandler.ts`
- Modify: `src/core/application.ts`
- Modify: `src/index.ts`
- Create: `tests/error-handler.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/error-handler.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { mimi } from '../src/core/application';

async function request(
  server: http.Server,
  path: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const req = http.request(
      { hostname: '127.0.0.1', port: addr.port, path, method: 'GET' },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: raw }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('app.setErrorHandler()', () => {
  let server: http.Server;
  let app: ReturnType<typeof mimi>;

  beforeAll(async () => {
    app = mimi();

    app.get('/boom', (_req, _res, next) => {
      next(new Error('something broke'));
    });

    app.get('/http-error', (_req, _res, next) => {
      const err = Object.assign(new Error('not found'), { status: 404 });
      next(err);
    });

    app.setErrorHandler((err, _req, res) => {
      const status = (err as any).status ?? 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const body = JSON.stringify({ error: err.message, code: 'CUSTOM_HANDLER' });
      res.setHeader('Content-Length', Buffer.byteLength(body));
      res.end(body);
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve) as unknown as http.Server;
    });
  });

  afterAll(() => { server.close(); });

  it('custom handler receives the error and formats the response', async () => {
    const { status, body } = await request(server, '/boom');
    expect(status).toBe(500);
    const data = JSON.parse(body);
    expect(data.error).toBe('something broke');
    expect(data.code).toBe('CUSTOM_HANDLER');
  });

  it('custom handler receives error.status and can use it', async () => {
    const { status } = await request(server, '/http-error');
    expect(status).toBe(404);
  });

  it('routes without errors still return normally', async () => {
    app.get('/ok', (_req, res) => res.json({ ok: true }));
    const { status, body } = await request(server, '/ok');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ ok: true });
  });

  it('returns 404 for unknown routes (unaffected by error handler)', async () => {
    const { status } = await request(server, '/nonexistent');
    expect(status).toBe(404);
  });
});

describe('default error handler (no setErrorHandler called)', () => {
  let server: http.Server;

  beforeAll(async () => {
    const app = mimi();
    app.get('/fail', (_req, _res, next) => next(new Error('default error')));
    await new Promise<void>((resolve) => {
      server = app.listen(0, resolve) as unknown as http.Server;
    });
  });

  afterAll(() => { server.close(); });

  it('sends 500 JSON with the error message', async () => {
    const { status, body } = await request(server, '/fail');
    expect(status).toBe(500);
    const data = JSON.parse(body);
    expect(data.error).toBe('default error');
    expect(data.code).toBeUndefined(); // default handler does not add code
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run tests/error-handler.test.ts
```

Expected: FAIL — `app.setErrorHandler is not a function`.

- [ ] **Step 3: Add `AppErrorHandler` type and `setErrorHandler` to `src/types/index.ts`**

Add these two exports after the `Plugin` type (around line 62):

```typescript
export type AppErrorHandler = (
  err: Error,
  req: MimiRequest,
  res: MimiResponse,
) => void | Promise<void>;
```

And add `setErrorHandler` to the `MimiApp` interface (after the `register` line):

```typescript
setErrorHandler(fn: AppErrorHandler): this;
```

The full updated `MimiApp` interface block (replace the existing one):

```typescript
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
```

- [ ] **Step 4: Rewrite `src/core/finalhandler.ts`**

Replace the full file:

```typescript
import type { IncomingMessage, ServerResponse } from 'http';
import type { MimiRequest, MimiResponse, AppErrorHandler } from '../types';

export function createFinalHandler(
  req: IncomingMessage,
  res: ServerResponse,
  errorHandler?: AppErrorHandler,
): (err?: Error | string) => void {
  return function done(err?: Error | string): void {
    if (res.headersSent) return;

    if (err) {
      const error = typeof err === 'string' ? new Error(err) : err;

      if (errorHandler) {
        try {
          const result = errorHandler(error, req as MimiRequest, res as MimiResponse);
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(() => {
              if (!res.headersSent) sendDefaultError(res, error);
            });
          }
        } catch {
          if (!res.headersSent) sendDefaultError(res, error);
        }
        return;
      }

      sendDefaultError(res, error);
      return;
    }

    const msg = `Cannot ${req.method ?? 'GET'} ${req.url ?? '/'}`;
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(msg));
    try { res.end(msg); } catch { /* headers already sent */ }
  };
}

function sendDefaultError(res: ServerResponse, error: Error): void {
  const status = (error as any).status ?? (error as any).statusCode ?? 500;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const body = JSON.stringify({ error: error.message || 'Internal Server Error' });
  res.setHeader('Content-Length', Buffer.byteLength(body));
  try { res.end(body); } catch { /* headers already sent */ }
}
```

- [ ] **Step 5: Update `src/core/application.ts`**

Add `AppErrorHandler` to the import line and wire in `errorHandler`:

```typescript
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

  (mimiApp as any).use = function (
    path: string | Middleware,
    ...fns: Middleware[]
  ): MimiApp {
    router.use(path as any, ...(fns as any[]));
    return mimiApp;
  };

  (mimiApp as any).route = function (path: string): Route {
    return router.route(path);
  };

  const HTTP_METHODS = [
    'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all',
  ] as const;

  HTTP_METHODS.forEach((method) => {
    (mimiApp as any)[method] = function (path: string, ...handlers: RequestHandler[]): MimiApp {
      (router as any)[method](path, ...handlers);
      return mimiApp;
    };
  });

  (mimiApp as any).listen = function (
    port: number,
    callback?: () => void,
  ): http.Server {
    const server = http.createServer(app);
    return server.listen(port, callback);
  };

  (mimiApp as any).register = createRegister(mimiApp);

  (mimiApp as any).setErrorHandler = function (fn: AppErrorHandler): MimiApp {
    errorHandler = fn;
    return mimiApp;
  };

  loadRoutes(mimiApp).catch(() => {});

  return mimiApp;
}
```

- [ ] **Step 6: Export `AppErrorHandler` from `src/index.ts`**

In `src/index.ts`, add `AppErrorHandler` to the existing types export block:

```typescript
export type {
  MimiApp,
  MimiRequest,
  MimiResponse,
  RequestHandler,
  ErrorHandler,
  AppErrorHandler,
  NextFunction,
  Middleware,
  Plugin,
  Route,
} from './types';
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/error-handler.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 8: Build to confirm no TypeScript errors**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/core/finalhandler.ts src/core/application.ts src/index.ts tests/error-handler.test.ts
git commit -m "feat(app): add setErrorHandler() for structured production error responses"
```

---

## Task 3: Replace winston with pino

**Problem:** winston loads ~6 MB of dependencies on startup (colorize, logform, triple-beam, etc.) and produces human-readable string logs — the opposite of what production observability needs. pino produces JSON logs, is 7× faster under load, and is 6 MB lighter.

**Files:**
- Modify: `src/middleware/logger.ts`
- Modify: `package.json`
- Create: `tests/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/logger.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('logger', () => {
  it('exports a logger with info, warn, error methods', async () => {
    const { logger } = await import('../src/middleware/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('exports requestLogger as a function with length 3', async () => {
    const { requestLogger } = await import('../src/middleware/logger');
    expect(typeof requestLogger).toBe('function');
    expect(requestLogger.length).toBe(3);
  });

  it('requestLogger calls next() synchronously', async () => {
    const { requestLogger } = await import('../src/middleware/logger');
    const req: any = { method: 'GET', url: '/test', headers: {} };
    const res: any = {
      on: vi.fn(),
      statusCode: 200,
    };
    const next = vi.fn();
    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to confirm it passes already (baseline)**

```bash
npx vitest run tests/logger.test.ts
```

Expected: all 3 tests pass — this confirms the interface contract before we swap the implementation.

- [ ] **Step 3: Install pino, remove winston**

```bash
npm install pino
npm uninstall winston
npm install --save-dev @types/pino 2>/dev/null || true
```

Verify pino is installed:

```bash
node -e "require('pino'); console.log('pino ok')"
```

Expected: `pino ok`

- [ ] **Step 4: Rewrite `src/middleware/logger.ts`**

Replace the full file:

```typescript
import pino from 'pino';
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from '../types';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});

export const requestLogger: RequestHandler = (
  req: MimiRequest,
  res: MimiResponse,
  next: NextFunction,
): void => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
};
```

- [ ] **Step 5: Run tests to verify they still pass**

```bash
npx vitest run tests/logger.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 6: Build to confirm no TypeScript errors**

```bash
npm run build
```

Expected: exits 0. If TypeScript can't find pino types, add `"@types/pino": "^8"` to devDependencies or add `"pino"` to tsconfig's `types` array — pino v8+ ships its own types so this should not be needed.

- [ ] **Step 7: Verify winston is gone from the dependency tree**

```bash
node -e "try { require('winston'); console.log('STILL PRESENT'); } catch { console.log('winston removed ok'); }"
```

Expected: `winston removed ok`

- [ ] **Step 8: Commit**

```bash
git add src/middleware/logger.ts package.json package-lock.json tests/logger.test.ts
git commit -m "perf(logger): replace winston with pino — 7x faster, -6 MB RSS"
```

---

## Task 4: Move Heavyweight Dependencies to peerDependencies

**Problem:** Every consumer pays the startup cost of mongoose (~8 MB), sequelize + sqlite3 (~10 MB), and bcrypt (~2 MB) even if they never call `mongodbManager`, `SQLiteManager`, or `hashPassword`. That's ~20 MB of dead weight per process.

**Fix:** Move these three to `peerDependencies` (optional) and keep them in `devDependencies` so tests still work. Wrap each module's import in a lazy require with a helpful install hint.

**Files:**
- Modify: `package.json`
- Modify: `src/db/mongodb/index.ts`
- Modify: `src/db/sqllite/index.ts`
- Modify: `src/auth/authHelper.ts`
- Create: `tests/peer-deps.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/peer-deps.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('peer dependency lazy loading', () => {
  it('mongodbManager throws a helpful error if mongoose is not installed', async () => {
    // Simulate mongoose being absent by temporarily mocking the require
    vi.mock('mongoose', () => { throw new Error('Cannot find module'); });
    const { mongodbManager } = await import('../src/db/mongodb/index');
    expect(() => mongodbManager.connect('mongodb://localhost/test')).toThrow(
      /npm install mongoose/,
    );
    vi.unmock('mongoose');
  });

  it('SQLiteManager throws a helpful error if sequelize is not installed', async () => {
    vi.mock('sequelize', () => { throw new Error('Cannot find module'); });
    const { SQLiteManager } = await import('../src/db/sqllite/index');
    expect(() => new SQLiteManager()).toThrow(/npm install sequelize sqlite3/);
    vi.unmock('sequelize');
  });

  it('hashPassword throws a helpful error if bcrypt is not installed', async () => {
    vi.mock('bcrypt', () => { throw new Error('Cannot find module'); });
    const { hashPassword } = await import('../src/auth/authHelper');
    await expect(hashPassword('secret')).rejects.toThrow(/npm install bcrypt/);
    vi.unmock('bcrypt');
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npx vitest run tests/peer-deps.test.ts
```

Expected: FAIL — current code imports mongoose/sequelize/bcrypt eagerly; mocking them will either have no effect or cause different errors.

- [ ] **Step 3: Read the current `src/db/mongodb/index.ts`**

```bash
cat src/db/mongodb/index.ts
```

Note the mongoose import line — it will be replaced with a lazy require guard.

- [ ] **Step 4: Rewrite `src/db/mongodb/index.ts`**

Replace the full file:

```typescript
let _mongoose: typeof import('mongoose') | null = null;

function getMongoose(): typeof import('mongoose') {
  if (_mongoose) return _mongoose;
  try {
    _mongoose = require('mongoose') as typeof import('mongoose');
    return _mongoose;
  } catch {
    throw new Error(
      '[mimijs] mongoose is not installed. Run: npm install mongoose',
    );
  }
}

class MongodbManager {
  private _connection: import('mongoose').Connection | null = null;

  async connect(uri: string, options: Record<string, unknown> = {}): Promise<void> {
    const mongoose = getMongoose();
    await mongoose.connect(uri, options as any);
    this._connection = mongoose.connection;
  }

  async disconnect(): Promise<void> {
    const mongoose = getMongoose();
    await mongoose.disconnect();
  }

  get connection(): import('mongoose').Connection | null {
    return this._connection;
  }
}

export const mongodbManager = new MongodbManager();
```

- [ ] **Step 5: Read the current `src/db/sqllite/index.ts`**

```bash
cat src/db/sqllite/index.ts
```

Note the sequelize import line.

- [ ] **Step 6: Rewrite `src/db/sqllite/index.ts`**

Replace the full file:

```typescript
function getSequelize(): typeof import('sequelize') {
  try {
    return require('sequelize') as typeof import('sequelize');
  } catch {
    throw new Error(
      '[mimijs] sequelize and sqlite3 are not installed. Run: npm install sequelize sqlite3',
    );
  }
}

export class SQLiteManager {
  private sequelize: import('sequelize').Sequelize | null = null;

  constructor(storagePath = ':memory:') {
    const { Sequelize } = getSequelize();
    this.sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: storagePath,
      logging: false,
    });
  }

  async connect(): Promise<void> {
    await this.sequelize!.authenticate();
  }

  async disconnect(): Promise<void> {
    await this.sequelize!.close();
  }

  get instance(): import('sequelize').Sequelize {
    return this.sequelize!;
  }
}
```

- [ ] **Step 7: Read the current `src/auth/authHelper.ts`**

```bash
cat src/auth/authHelper.ts
```

Note the bcrypt import line.

- [ ] **Step 8: Rewrite `src/auth/authHelper.ts`**

Replace the full file (preserve all existing exported function signatures):

```typescript
import jwt from 'jsonwebtoken';

function getBcrypt(): typeof import('bcrypt') {
  try {
    return require('bcrypt') as typeof import('bcrypt');
  } catch {
    throw new Error(
      '[mimijs] bcrypt is not installed. Run: npm install bcrypt',
    );
  }
}

export async function hashPassword(password: string, saltRounds = 10): Promise<string> {
  return getBcrypt().hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return getBcrypt().compare(password, hash);
}

export interface TokenPayload {
  [key: string]: unknown;
}

export function generateToken(payload: TokenPayload, expiresIn = '1h'): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('[mimijs] JWT_SECRET environment variable is not set');
  return jwt.sign(payload, secret, { expiresIn } as any);
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('[mimijs] JWT_SECRET environment variable is not set');
  return jwt.verify(token, secret) as TokenPayload;
}
```

- [ ] **Step 9: Update `package.json`**

Move `mongoose`, `sequelize`, `sqlite3`, `bcrypt` from `dependencies` to `peerDependencies` (optional), and add them to `devDependencies` so they remain available in tests. The resulting `package.json` sections:

```json
"dependencies": {
  "content-type": "^1.0.5",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "jsonwebtoken": "^9.0.2",
  "mime-types": "^2.1.35",
  "path-to-regexp": "^6.3.0",
  "pino": "^9.0.0",
  "qs": "^6.12.0",
  "raw-body": "^2.5.2",
  "send": "^0.18.0",
  "swagger-jsdoc": "^6.2.8"
},
"peerDependencies": {
  "bcrypt": ">=5",
  "mongoose": ">=8",
  "sequelize": ">=6",
  "sqlite3": ">=5"
},
"peerDependenciesMeta": {
  "bcrypt": { "optional": true },
  "mongoose": { "optional": true },
  "sequelize": { "optional": true },
  "sqlite3": { "optional": true }
},
"devDependencies": {
  "@types/bcrypt": "^5.0.2",
  "@types/content-type": "^1.1.8",
  "@types/jsonwebtoken": "^9.0.6",
  "@types/mime-types": "^2.1.4",
  "@types/node": "^20.14.11",
  "@types/qs": "^6.9.15",
  "@types/raw-body": "^2.3.0",
  "@types/send": "^0.17.4",
  "@types/swagger-jsdoc": "^6.0.4",
  "autocannon": "...",
  "bcrypt": "^5.1.1",
  "express": "...",
  "fastify": "...",
  "mongoose": "^8.5.1",
  "sequelize": "^6.37.3",
  "sqlite3": "^5.1.7",
  "ts-node": "^10.9.2",
  "typescript": "^5.5.3",
  "vitest": "..."
}
```

Note: Keep the exact version strings from your current `package.json`. Only move the packages, don't change versions.

- [ ] **Step 10: Run tests to verify they pass**

```bash
npx vitest run tests/peer-deps.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 11: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass. If any test uses `mongodbManager`, `SQLiteManager`, or `hashPassword` directly, it will still work because those packages remain in `devDependencies`.

- [ ] **Step 12: Build to confirm no TypeScript errors**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 13: Commit**

```bash
git add src/db/mongodb/index.ts src/db/sqllite/index.ts src/auth/authHelper.ts package.json package-lock.json tests/peer-deps.test.ts
git commit -m "perf(deps): move mongoose/sequelize/bcrypt to optional peer deps — ~20 MB RSS reduction per process"
```

---

## Self-Review Against Architecture Analysis

| Analysis requirement | Task |
|----------------------|------|
| Parse URL once at request entry | Task 1 ✓ |
| `app.setErrorHandler(fn)` | Task 2 ✓ |
| Replace winston with pino (−6 MB RSS, 7× faster) | Task 3 ✓ |
| Move mongoose/sequelize/bcrypt to peer deps (−20 MB RSS) | Task 4 ✓ |
| `AppErrorHandler` type exported for consumers | Task 2 Step 6 ✓ |
| Graceful missing-peer error messages | Task 4 Steps 4/6/8 ✓ |
| Backward-compatible (no removed exports) | All tasks — interfaces preserved ✓ |
| `npm run build` exits 0 after each task | Steps in Tasks 1/2/3/4 ✓ |

**Placeholder scan:** No TBD, TODO, or incomplete sections found.

**Type consistency:** `AppErrorHandler` defined in Task 2 Step 3, used in Tasks 2 Steps 4 and 5. `getMongoose`, `getSequelize`, `getBcrypt` defined and used within the same task. No cross-task type references.

**Spec gaps:** The analysis also listed "radix trie router" as Tier 1. This is fully specced in `docs/superpowers/plans/2026-04-19-mimijs-v2.1.md` Tasks 5–6 and is NOT duplicated here intentionally.
