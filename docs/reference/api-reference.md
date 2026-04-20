---
title: API Reference
outline: deep
---

# API Reference

Complete reference for every export from `mimi.js`.

---

## `mimi()` — App Factory

```typescript
import mimi from 'mimi.js';
const app = mimi();
```

Returns a `MimiApp` instance. Each call creates an independent app.

---

## MimiApp

### HTTP Method Handlers

All return `this` for chaining.

```typescript
app.get(path: string, ...handlers: RequestHandler[]): MimiApp
app.post(path: string, ...handlers: RequestHandler[]): MimiApp
app.put(path: string, ...handlers: RequestHandler[]): MimiApp
app.patch(path: string, ...handlers: RequestHandler[]): MimiApp
app.delete(path: string, ...handlers: RequestHandler[]): MimiApp
app.head(path: string, ...handlers: RequestHandler[]): MimiApp
app.options(path: string, ...handlers: RequestHandler[]): MimiApp
app.all(path: string, ...handlers: RequestHandler[]): MimiApp
```

### `app.use([path], ...middleware)`

Mounts middleware globally or at a path prefix.

```typescript
app.use(json())                    // global — runs on every request
app.use('/api', authMiddleware)    // only requests under /api
app.use('/api/v1', router)         // mount a sub-Router
```

### `app.route(path)` → `Route`

Returns a `Route` object for chaining multiple HTTP methods on the same path without repeating it.

```typescript
app.route('/users')
  .get(listUsers)
  .post(createUser);

app.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);
```

### `app.listen(port, [callback])` → `http.Server`

Creates an HTTP server and begins listening. Returns the native `http.Server` for lifecycle management.

```typescript
const server = app.listen(3000, () => console.log('Ready on :3000'));

// Graceful shutdown
server.close(() => console.log('Server closed'));
```

Pass `0` to bind to a random available port (useful in tests):

```typescript
const server = app.listen(0, () => {
  const { port } = server.address() as { port: number };
  console.log(`Listening on :${port}`);
});
```

### `app.register(plugin, [options])` → `MimiApp | Promise<MimiApp>`

Registers a plugin. For async plugins, `await` the result before calling `listen()`.

```typescript
app.register(myPlugin, { option: 'value' });
await app.register(asyncDatabasePlugin, { uri: process.env.MONGO_URI! });
```

### `app.setErrorHandler(fn)` → `MimiApp`

Registers a global error handler. Intercepts all `next(err)` calls before the default response is sent. Returns `this` for chaining.

```typescript
import type { AppErrorHandler } from 'mimi.js';

const handler: AppErrorHandler = (err, req, res) => {
  const status = (err as any).status ?? 500;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: err.message }));
};

app.setErrorHandler(handler);
```

See [Error Handling](/guide/error-handling) for full examples.

---

## MimiRequest

Extends Node's `http.IncomingMessage` with the following additions.

### Properties

| Property | Type | Description |
|---|---|---|
| `req.params` | `Record<string, string>` | URL route parameters (e.g., `:id` → `req.params.id`) |
| `req.query` | `Record<string, string>` | Parsed query string (e.g., `?page=2` → `req.query.page`) |
| `req.body` | `unknown` | Parsed request body (set by `json()` or `urlencoded()`) |
| `req.path` | `string` | URL pathname without query string |
| `req.hostname` | `string` | Host header value without port |
| `req.ip` | `string` | Remote client IP address |
| `req.locals` | `Record<string, unknown>` | Per-request storage for passing data between handlers |

### Methods

#### `req.get(name)` → `string | undefined`

Returns the value of a request header. Case-insensitive. Handles `referrer`/`referer` aliasing.

```typescript
req.get('content-type')      // → 'application/json'
req.get('Authorization')     // → 'Bearer eyJ...'
req.get('X-Request-ID')      // → '123abc' or undefined
```

#### `req.is(type)` → `string | false`

Checks if the `Content-Type` header matches the given type. Returns the matched MIME type or `false`.

```typescript
req.is('json')                 // → 'application/json' or false
req.is('application/json')    // → 'application/json' or false
req.is('text')                 // → 'text/plain' or false
```

---

## MimiResponse

Extends Node's `http.ServerResponse` with the following additions.

### Properties

| Property | Type | Description |
|---|---|---|
| `res.locals` | `Record<string, unknown>` | Per-request storage (same object as `req.locals`) |

### Methods

| Method | Signature | Description |
|---|---|---|
| `res.status(code)` | `(code: number) => this` | Set the HTTP status code. Chainable. |
| `res.json(obj)` | `(obj: unknown) => void` | Send JSON body with `Content-Type: application/json; charset=utf-8` |
| `res.send(body)` | `(body: unknown) => void` | Send a response. Strings → `text/html`, Buffers → `application/octet-stream`, objects → JSON |
| `res.sendStatus(code)` | `(code: number) => void` | Send status code + status text as body (e.g., `204 No Content`) |
| `res.redirect(url, status?)` | `(url: string, status?: number) => void` | Redirect to `url`. Default status: `302` |
| `res.set(field, value)` | `(field: string, value: string) => this` | Set a response header. Chainable. |
| `res.set(obj)` | `(obj: Record<string, string>) => this` | Set multiple response headers at once. Chainable. |
| `res.type(contentType)` | `(contentType: string) => this` | Set `Content-Type`. Chainable. Accepts extension (e.g., `'json'`, `'html'`) or full MIME type. |

---

## Middleware Factories

### `json(options?)`

Parse `application/json` request bodies. Skips GET, HEAD, OPTIONS automatically.

```typescript
import { json } from 'mimi.js';
app.use(json());
app.use(json({ limit: '5mb' }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `limit` | `string` | `'1mb'` | Maximum body size |

### `urlencoded(options?)`

Parse `application/x-www-form-urlencoded` bodies.

```typescript
import { urlencoded } from 'mimi.js';
app.use(urlencoded({ extended: true }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `extended` | `boolean` | `true` | `true` = nested objects via `qs`; `false` = flat via `URLSearchParams` |
| `limit` | `string` | `'1mb'` | Maximum body size |

### `cors(options?)`

Add CORS headers. Handles `OPTIONS` preflight automatically.

```typescript
import { cors } from 'mimi.js';
app.use(cors({ origin: 'https://app.com', credentials: true }));
```

| Option | Type | Default |
|---|---|---|
| `origin` | `string \| string[] \| (origin: string) => string \| false` | `'*'` |
| `methods` | `string[]` | `['GET','HEAD','PUT','PATCH','POST','DELETE']` |
| `allowedHeaders` | `string[]` | mirrors request headers |
| `exposedHeaders` | `string[]` | `[]` |
| `credentials` | `boolean` | `false` |
| `maxAge` | `number` | — |

### `security(options?)`

Set security-related HTTP response headers.

```typescript
import { security } from 'mimi.js';
app.use(security());
app.use(security({ contentSecurityPolicy: false }));
```

| Option | Default |
|---|---|
| `contentSecurityPolicy` | `"default-src 'self'"` |
| `xFrameOptions` | `'SAMEORIGIN'` |
| `xContentTypeOptions` | enabled |
| `xXssProtection` | enabled |
| `dnsPrefetchControl` | enabled |
| `permittedCrossDomainPolicies` | `'none'` |
| `downloadOptions` | enabled |
| `removePoweredBy` | enabled |

Pass `false` for any option to disable that specific header.

### `serveStatic(root, options?)`

Serve static files from a directory.

```typescript
import { serveStatic } from 'mimi.js';
app.use(serveStatic('./public', { maxAge: 86400, index: 'index.html' }));
```

| Option | Type | Default |
|---|---|---|
| `maxAge` | `number \| string` | `0` |
| `index` | `string \| false` | `'index.html'` |
| `dotfiles` | `'allow' \| 'deny' \| 'ignore'` | `'ignore'` |
| `etag` | `boolean` | `true` |
| `lastModified` | `boolean` | `true` |

### `requestLogger`

Log each request (method, url, status, elapsed ms) using pino. Not a factory — import directly.

```typescript
import { requestLogger } from 'mimi.js';
app.use(requestLogger);
```

### `customParser`

Parse `application/custom` bodies. Sets `req.body = {}`. Import directly.

```typescript
import { customParser } from 'mimi.js';
app.use(customParser);
```

---

## `logger`

The pino logger instance used internally by `requestLogger`. Import for structured logging in your own code.

```typescript
import { logger } from 'mimi.js';

logger.info({ userId: '42' }, 'User logged in');
logger.error({ err }, 'Database query failed');
```

Level controlled by `LOG_LEVEL` environment variable (default: `'info'`).

---

## Authentication

### `hashPassword(password)` → `Promise<string>`

Hash a password with bcrypt (10 salt rounds). Requires `npm install bcrypt`.

```typescript
import { hashPassword } from 'mimi.js';
const hash = await hashPassword('my-password');
```

### `comparePassword(password, hash)` → `Promise<boolean>`

Compare a plain-text password to a bcrypt hash.

```typescript
import { comparePassword } from 'mimi.js';
const valid = await comparePassword('my-password', hash);
```

### `generateToken(user)` → `string`

Sign a JWT with `process.env.JWT_SECRET`. Expires in 1 hour.

```typescript
import { generateToken } from 'mimi.js';
const token = generateToken({ id: '42', email: 'user@example.com' });
```

### `verifyToken(token)` → `TokenPayload | null`

Verify a JWT. Returns the decoded payload or `null` if invalid/expired. Pins algorithm to HS256.

```typescript
import { verifyToken } from 'mimi.js';
const payload = verifyToken(token);
if (!payload) return res.status(401).json({ error: 'Invalid token' });
```

### `authMiddleware`

Route middleware that reads `Authorization: Bearer <token>`, verifies it, and sets `(req as any).user` to the decoded payload. Returns `401` on missing or invalid tokens.

```typescript
import { authMiddleware } from 'mimi.js';
app.get('/me', authMiddleware, (req, res) => {
  res.json({ user: (req as any).user });
});
```

### `TokenPayload`

```typescript
interface TokenPayload {
  id: string | number;
  email: string;
}
```

---

## Database

### `mongodbManager`

Singleton MongoDB manager. Requires `npm install mongoose`.

```typescript
import { mongodbManager } from 'mimi.js';
```

| Member | Signature | Description |
|---|---|---|
| `connect(uri, options?)` | `(string, object?) => Promise<string>` | Connect to MongoDB |
| `createCollection(name, schema)` | `(string, object) => unknown` | Define a Mongoose model with timestamps |

### `SQLiteManager`

SQLite manager class. Requires `npm install sequelize sqlite3`.

```typescript
import { SQLiteManager } from 'mimi.js';
const db = new SQLiteManager('./data.sqlite'); // or ':memory:'
```

| Member | Signature | Description |
|---|---|---|
| `new SQLiteManager(path?)` | Constructor | Create Sequelize instance. Default: `':memory:'` |
| `connect()` | `() => Promise<string>` | Authenticate and verify connection |
| `sequelize` | `Sequelize` | Raw Sequelize instance for model definitions |

---

## Router

Import the `Router` class to create sub-routers:

```typescript
import { Router } from 'mimi.js';
const router = new Router();

router.get('/', listItems);
router.post('/', createItem);
router.get('/:id', getItem);

app.use('/items', router);
```

Supports the same methods as `MimiApp`: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all`, `use`, `route`.

---

## Swagger

### `setupSwagger(app, options)`

Mount Swagger UI at `/api-docs` and the OpenAPI spec at `/api-docs/swagger.json`.

```typescript
import { setupSwagger } from 'mimi.js';

setupSwagger(app, {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API documentation',
  },
  filesPattern: './**/*.js',
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
});
```

| Option | Type | Description |
|---|---|---|
| `info.title` | `string` | API title (required) |
| `info.version` | `string` | API version (required) |
| `info.description` | `string` | Optional description |
| `filesPattern` | `string` | Glob pattern for files with JSDoc annotations (default: `'./**/*.js'`) |
| `servers` | `{ url, description? }[]` | Server list shown in Swagger UI |

---

## Type Exports

All types can be imported from `'mimi.js'`:

```typescript
import type {
  MimiApp,
  MimiRequest,
  MimiResponse,
  RequestHandler,   // (req, res, next) => void | Promise<void>
  ErrorHandler,     // (err, req, res, next) => void  — 4-arg error middleware
  AppErrorHandler,  // (err, req, res) => void | Promise<void>  — for setErrorHandler
  NextFunction,     // (err?: Error | string) => void
  Middleware,       // RequestHandler | ErrorHandler
  Plugin,           // (app, options) => void | Promise<void>
  Route,            // returned by app.route()
} from 'mimi.js';
```
