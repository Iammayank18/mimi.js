---
title: API Reference
nav_order: 8
---

# API Reference
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## `mimi()` → `MimiApp`

Creates and returns a new application instance.

```typescript
import mimi from 'mimi.js';
const app = mimi();
```

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
app.use(json())                    // global
app.use('/api', authMiddleware)    // prefix-scoped
app.use('/api', router)            // mount a Router
```

### `app.route(path)` → `Route`

Returns a `Route` object for chaining multiple HTTP methods on the same path.

```typescript
app.route('/users')
  .get(listUsers)
  .post(createUser);
```

### `app.listen(port, [callback])` → `http.Server`

Starts the HTTP server on the given port.

```typescript
const server = app.listen(3000, () => console.log('Ready'));
```

### `app.register(plugin, [options])` → `MimiApp | Promise<MimiApp>`

Registers a plugin. Supports both sync and async plugins.

```typescript
app.register(myPlugin, { option: 'value' });
await app.register(asyncPlugin);
```

---

## MimiRequest

Extends Node's `http.IncomingMessage`.

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `req.params` | `Record<string, string>` | Route parameters |
| `req.query` | `Record<string, string>` | Parsed query string |
| `req.body` | `unknown` | Parsed request body |
| `req.path` | `string` | URL pathname (without query string) |
| `req.hostname` | `string` | Host header value (no port) |
| `req.ip` | `string` | Remote client IP |
| `req.locals` | `Record<string, unknown>` | Per-request middleware storage |
| `req.get(name)` | `string \| undefined` | Get a request header by name |
| `req.is(type)` | `string \| false` | Check `Content-Type` against a mime type |

---

## MimiResponse

Extends Node's `http.ServerResponse`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `res.status(code)` | `(code: number) => this` | Set status code, returns `res` |
| `res.json(obj)` | `(obj: unknown) => void` | Send JSON with `Content-Type: application/json` |
| `res.send(body)` | `(body: unknown) => void` | Send response (auto-detects type) |
| `res.sendStatus(code)` | `(code: number) => void` | Send status + its text as body |
| `res.redirect(url, [status])` | `(url: string, status?: number) => void` | Redirect (default 302) |
| `res.set(field, value)` | `(field: string, value: string) => this` | Set response header |
| `res.set(obj)` | `(obj: Record<string, string>) => this` | Set multiple headers at once |
| `res.type(contentType)` | `(contentType: string) => this` | Set `Content-Type` |
| `res.locals` | `Record<string, unknown>` | Per-request storage |

---

## Router

```typescript
import { Router } from 'mimi.js';

const router = Router();
router.get('/path', handler);
router.post('/path', handler);

app.use('/prefix', router);
```

Supports the same HTTP method shortcuts as `MimiApp`.

---

## Middleware Factories

### `json(options?)`

```typescript
import { json } from 'mimi.js';
app.use(json({ limit: '1mb' }));
```

### `urlencoded(options?)`

```typescript
import { urlencoded } from 'mimi.js';
app.use(urlencoded({ extended: true }));
```

### `cors(options?)`

```typescript
import { cors } from 'mimi.js';
app.use(cors({ origin: 'https://example.com', credentials: true }));
```

Full options: `origin`, `methods`, `allowedHeaders`, `exposedHeaders`, `credentials`, `maxAge`.

### `security(options?)`

```typescript
import { security } from 'mimi.js';
app.use(security({ contentSecurityPolicy: false }));
```

### `serveStatic(root, options?)`

```typescript
import { serveStatic } from 'mimi.js';
app.use(serveStatic('./public', { maxAge: 86400000 }));
```

### `requestLogger`

```typescript
import { requestLogger } from 'mimi.js';
app.use(requestLogger);
```

### `customParser`

```typescript
import { customParser } from 'mimi.js';
app.use(customParser);
```

---

## Auth

All auth exports require `bcrypt` to be installed as a peer dependency (`npm install bcrypt`).

```typescript
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
} from 'mimi.js';
```

| Export | Signature | Description |
|--------|-----------|-------------|
| `hashPassword` | `(password: string, saltRounds?: number) => Promise<string>` | Hash with bcrypt |
| `comparePassword` | `(password: string, hash: string) => Promise<boolean>` | Verify bcrypt hash |
| `generateToken` | `(payload: object, expiresIn?: string) => string` | Sign JWT |
| `verifyToken` | `(token: string) => TokenPayload` | Verify + decode JWT |
| `authMiddleware` | `RequestHandler` | Require `Authorization: Bearer <token>` |

Requires `JWT_SECRET` environment variable for `generateToken` and `verifyToken`.

---

## Database

### `mongodbManager`

Requires `npm install mongoose`.

```typescript
import { mongodbManager } from 'mimi.js';

await mongodbManager.connect('mongodb://localhost:27017/mydb');
await mongodbManager.disconnect();
const conn = mongodbManager.connection; // mongoose.Connection | null
```

### `SQLiteManager`

Requires `npm install sequelize sqlite3`.

```typescript
import { SQLiteManager } from 'mimi.js';

const db = new SQLiteManager('./data.sqlite'); // or ':memory:'
await db.connect();
await db.disconnect();
const seq = db.instance; // Sequelize instance
```

---

## Swagger

```typescript
import { setupSwagger } from 'mimi.js';
import type { SwaggerOptions } from 'mimi.js';

setupSwagger(app, {
  info: { title: 'My API', version: '1.0.0' },
  filesPattern: './**/*.js',
});
```

---

## Plugin

```typescript
import type { Plugin } from 'mimi.js';

const myPlugin: Plugin = (app, options) => {
  app.use(someMiddleware);
  app.get('/plugin-route', handler);
};

app.register(myPlugin, { key: 'value' });
```

---

## Type Exports

```typescript
import type {
  MimiApp,
  MimiRequest,
  MimiResponse,
  RequestHandler,
  ErrorHandler,
  NextFunction,
  Middleware,
  Plugin,
  Route,
  TokenPayload,
  SwaggerOptions,
} from 'mimi.js';
```
