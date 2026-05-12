---
title: API Reference
outline: deep
---

# API Reference

Complete reference for every export from `mimi.js`.

---

## `mimi(options?)` — App Factory

```typescript
import mimi from 'mimi.js';

// Basic — no docs
const app = mimi();

// With auto-generated Swagger docs
const app = mimi({
  docs: {
    info: { title: 'My API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  },
});
```

Returns a `MimiApp` instance. Each call creates an independent app.

### MimiOptions

```typescript
interface MimiOptions {
  docs?: SwaggerOptions;
}
```

Pass `docs` to enable Swagger UI at `/api-docs` and the raw OpenAPI spec at `/api-docs/swagger.json`. Assets are served from the local `swagger-ui-dist` package — no CDN, no CSP setup needed.

See [SwaggerOptions](#swaggeroptions) for the full `docs` shape.

---

## MimiApp

### HTTP Method Handlers

All return `this` for chaining. Each method accepts an optional `RouteSchema` as the second argument for automatic validation and Swagger documentation.

```typescript
// Without schema
app.get(path: string, ...handlers: RequestHandler[]): MimiApp

// With schema (validates request + generates docs)
app.get(path: string, schema: RouteSchema, ...handlers: RequestHandler[]): MimiApp
```

Available methods: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all`.

```typescript
app.get('/users', handler)
app.post('/users', { summary: 'Create user', body: CreateSchema }, handler)
app.delete('/users/:id', { security: [{ bearerAuth: [] }] }, authMiddleware, handler)
```

### `app.use([path], ...middleware)`

Mounts middleware globally or at a path prefix.

```typescript
app.use(json())                    // runs on every request
app.use('/api', authMiddleware)    // only requests under /api
app.use('/api/v1', router)         // mount a sub-Router
```

### `app.route(path)` → `Route`

Returns a `Route` object for chaining multiple HTTP methods on the same path. Accepts an optional `RouteSchema` on each method.

```typescript
app.route('/users')
  .get(listUsers)
  .post({ body: CreateUserSchema }, createUser);

app.route('/users/:id')
  .get({ params: z.object({ id: z.string().uuid() }) }, getUser)
  .put(updateUser)
  .delete(deleteUser);
```

### `app.listen(port, [callback])` → `http.Server`

Creates an HTTP server and begins listening. Returns the native `http.Server`.

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

Registers a global error handler. Intercepts all `next(err)` calls before the default 500 response.

```typescript
import type { AppErrorHandler } from 'mimi.js';

app.setErrorHandler((err, req, res) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message });
});
```

See [Error Handling](/guide/error-handling) for full examples.

---

## RouteSchema

Pass as the **second argument** to any route method to get automatic request validation and Swagger documentation.

```typescript
router.post('/users', {
  summary:  'Create a user',
  tags:     ['users'],
  security: [{ bearerAuth: [] }],
  body:     CreateUserSchema,
  response: { 201: UserSchema, 422: z.object({ error: z.string() }) },
}, handler);
```

| Field | Type | Description |
|---|---|---|
| `summary` | `string` | Short title shown in Swagger UI |
| `description` | `string` | Longer description of what the endpoint does |
| `tags` | `string[]` | Groups operations into sections in the sidebar |
| `deprecated` | `boolean` | Strikes through the operation in Swagger UI |
| `security` | `Record<string, string[]>[]` | Shows a lock icon — references a scheme from `components.securitySchemes` |
| `params` | `ZodSchema` | Validates `req.params`; generates path parameters in the spec |
| `query` | `ZodSchema` | Validates `req.query`; generates query parameters in the spec |
| `headers` | `ZodSchema` | Validates `req.headers`; generates header parameters in the spec |
| `body` | `ZodSchema` | Validates `req.body`; generates the `requestBody` in the spec |
| `response` | `Record<number, ZodSchema>` | Maps HTTP status codes to response schemas |

All fields are optional. When validation fails, the framework automatically returns `422` with Zod's error details — your handler never runs.

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
| `req.host` | `string` | Full Host header including port |
| `req.ip` | `string` | Remote client IP (prefers `X-Forwarded-For` first IP) |
| `req.ips` | `string[]` | All IPs from `X-Forwarded-For`, in order |
| `req.protocol` | `string` | `'http'` or `'https'` (checks `X-Forwarded-Proto`) |
| `req.secure` | `boolean` | `true` when `req.protocol === 'https'` |
| `req.xhr` | `boolean` | `true` when `X-Requested-With: XMLHttpRequest` |
| `req.fresh` | `boolean` | `true` when the response would be a 304 Not Modified (ETag/Last-Modified match) |
| `req.stale` | `boolean` | Opposite of `req.fresh` |
| `req.subdomains` | `string[]` | Subdomain parts of the hostname, reversed (e.g., `['api', 'v1']`) |
| `req.locals` | `Record<string, unknown>` | Per-request storage for passing data between handlers |

### Methods

#### `req.get(name)` / `req.header(name)` → `string | undefined`

Returns the value of a request header. Case-insensitive.

```typescript
req.get('content-type')      // → 'application/json'
req.get('Authorization')     // → 'Bearer eyJ...'
req.header('X-Request-ID')   // → '123abc' or undefined
```

#### `req.is(type)` → `string | false`

Checks if the `Content-Type` header matches the given type.

```typescript
req.is('json')               // → 'application/json' or false
req.is('text/html')          // → 'text/html' or false
```

#### `req.accepts(type?)` → `string | string[] | false`

Check which content types the client accepts (from the `Accept` header).

```typescript
req.accepts('json')          // → 'json' or false
req.accepts(['json', 'html']) // → best match
req.accepts()                // → all accepted types
```

#### `req.acceptsEncodings(encoding?)` → `string | string[] | false`

Check which encodings the client accepts (from `Accept-Encoding`).

```typescript
req.acceptsEncodings('gzip') // → 'gzip' or false
req.acceptsEncodings()       // → all accepted encodings
```

#### `req.acceptsCharsets(charset?)` → `string | string[] | false`

Check which charsets the client accepts (from `Accept-Charset`).

#### `req.acceptsLanguages(lang?)` → `string | string[] | false`

Check which languages the client accepts (from `Accept-Language`).

```typescript
req.acceptsLanguages('en')   // → 'en' or false
```

#### `req.range(size, options?)` → ranges | -1 | -2 | undefined`

Parse the `Range` header. Returns an array of `{ start, end }` objects, `-1` (unsatisfiable), or `-2` (malformed).

```typescript
const ranges = req.range(fileSize);
if (Array.isArray(ranges)) {
  const { start, end } = ranges[0];
}
```

---

## MimiResponse

Extends Node's `http.ServerResponse` with the following additions.

### Properties

| Property | Type | Description |
|---|---|---|
| `res.locals` | `Record<string, unknown>` | Per-request storage (same object as `req.locals`) |

### Sending Responses

| Method | Description |
|---|---|
| `res.json(obj)` | Send a JSON response with `Content-Type: application/json` |
| `res.send(body)` | Send a response. Strings → `text/html`, Buffers → binary, objects → JSON |
| `res.sendStatus(code)` | Send status code + status text as the body (e.g., `res.sendStatus(204)`) |
| `res.jsonp(obj)` | Send a JSONP response. Reads the callback name from `?callback=` query param |
| `res.sendFile(path, options?, cb?)` | Stream a file from disk. Sets `Content-Type` from the file extension |
| `res.download(path, filename?, options?, cb?)` | Send a file as an attachment (triggers browser download) |

### Setting Status & Headers

| Method | Description |
|---|---|
| `res.status(code)` | Set the HTTP status code. Returns `this` for chaining |
| `res.set(field, value)` / `res.header(field, value)` | Set a response header. Returns `this` |
| `res.set(obj)` | Set multiple headers at once from an object. Returns `this` |
| `res.get(field)` | Get the current value of a response header |
| `res.type(contentType)` / `res.contentType(contentType)` | Set `Content-Type`. Accepts extension (`'json'`) or full MIME type. Returns `this` |
| `res.append(field, value)` | Append a value to an existing header (or set if not present). Returns `this` |
| `res.location(url)` | Set the `Location` header. Pass `'back'` to use the `Referer`. Returns `this` |
| `res.vary(field)` | Append a field to the `Vary` header. Returns `this` |
| `res.links(links)` | Set the `Link` header from a `{ rel: url }` object. Returns `this` |
| `res.attachment(filename?)` | Set `Content-Disposition: attachment`. Optionally sets filename and `Content-Type`. Returns `this` |

### Redirects

```typescript
res.redirect('/new-path')        // 302
res.redirect(301, '/permanent')  // permanent redirect
res.redirect('back')             // redirect to Referer
```

### Cookies

#### `res.cookie(name, value, options?)` → `this`

Set a response cookie.

```typescript
res.cookie('session', token, { httpOnly: true, maxAge: 3600 * 1000 });
res.cookie('theme', 'dark', { sameSite: 'lax' });
```

| Option | Type | Description |
|---|---|---|
| `maxAge` | `number` | Max age in milliseconds |
| `expires` | `Date` | Expiry date |
| `httpOnly` | `boolean` | Prevents client-side JS access |
| `secure` | `boolean` | HTTPS only |
| `sameSite` | `'strict' \| 'lax' \| 'none' \| boolean` | SameSite policy |
| `path` | `string` | Cookie path (default: `/`) |
| `domain` | `string` | Cookie domain |

#### `res.clearCookie(name, options?)` → `this`

Expire a cookie immediately.

```typescript
res.clearCookie('session');
```

### Content Negotiation

#### `res.format(obj)` → `void`

Respond with different content based on the client's `Accept` header.

```typescript
res.format({
  'text/plain': () => res.send('Hello'),
  'application/json': () => res.json({ message: 'Hello' }),
  'text/html': () => res.send('<p>Hello</p>'),
});
```

---

## Middleware Factories

### `json(options?)`

Parse `application/json` request bodies. Skips GET, HEAD, OPTIONS automatically.

```typescript
app.use(json());
app.use(json({ limit: '5mb' }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `limit` | `string` | `'1mb'` | Maximum body size |

### `urlencoded(options?)`

Parse `application/x-www-form-urlencoded` bodies.

```typescript
app.use(urlencoded({ extended: true }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `extended` | `boolean` | `true` | `true` = nested objects via `qs`; `false` = flat via `URLSearchParams` |
| `limit` | `string` | `'1mb'` | Maximum body size |

### `cors(options?)`

Add CORS headers. Handles `OPTIONS` preflight automatically.

```typescript
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
const hash = await hashPassword('my-password');
```

### `comparePassword(password, hash)` → `Promise<boolean>`

Compare a plain-text password to a bcrypt hash.

```typescript
const valid = await comparePassword('my-password', hash);
```

### `generateToken(user)` → `string`

Sign a JWT with `process.env.JWT_SECRET`. Expires in 1 hour.

```typescript
const token = generateToken({ id: '42', email: 'user@example.com' });
```

### `verifyToken(token)` → `TokenPayload | null`

Verify a JWT. Returns the decoded payload or `null` if invalid/expired.

```typescript
const payload = verifyToken(token);
if (!payload) return res.status(401).json({ error: 'Invalid token' });
```

### `authMiddleware`

Reads `Authorization: Bearer <token>`, verifies it, and sets `(req as any).user` to the decoded payload. Returns `401` on missing or invalid tokens.

```typescript
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

| Member | Signature | Description |
|---|---|---|
| `connect(uri, options?)` | `(string, object?) => Promise<string>` | Connect to MongoDB |
| `createCollection(name, schema)` | `(string, object) => unknown` | Define a Mongoose model with timestamps |

### `SQLiteManager`

SQLite manager class. Requires `npm install sequelize sqlite3`.

```typescript
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

// Without schema
router.get('/items', listItems);

// With schema — validates request + auto-generates docs
router.post('/items', { summary: 'Create item', body: ItemSchema }, createItem);
router.get('/items/:id', { params: z.object({ id: z.string() }) }, getItem);

app.use('/api', router);
```

Supports the same methods as `MimiApp`: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all`, `use`, `route`.

---

## Swagger / OpenAPI

### `mimi({ docs })` — Recommended

Pass `docs` to the factory to enable Swagger without any extra imports or calls:

```typescript
const app = mimi({
  docs: {
    info: { title: 'My API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
});
```

### `setupSwagger(app, options)` — Explicit

Use when you need to register docs after initial setup:

```typescript
import { setupSwagger } from 'mimi.js';

setupSwagger(app, {
  info: { title: 'My API', version: '1.0.0' },
});
```

### SwaggerOptions

```typescript
interface SwaggerOptions {
  info: {
    title: string;        // shown in Swagger UI header
    version: string;      // e.g. '1.0.0'
    description?: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
  };
  servers?: Array<{ url: string; description?: string }>;
  /** Apply a security requirement to every operation */
  security?: Record<string, string[]>[];
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
  };
}
```

### SecurityScheme

```typescript
interface SecurityScheme {
  type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
  scheme?: string;         // for http: 'bearer' | 'basic'
  bearerFormat?: string;   // for bearer: 'JWT', 'Token', etc.
  in?: 'header' | 'query' | 'cookie';  // for apiKey
  name?: string;           // for apiKey: the header/query param name
  description?: string;
}
```

Common examples:

```typescript
// JWT Bearer token
bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }

// API key in a header
apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' }

// HTTP Basic auth
basicAuth: { type: 'http', scheme: 'basic' }
```

---

## Type Exports

All types can be imported from `'mimi.js'`:

```typescript
import type {
  // App
  MimiApp,
  MimiOptions,

  // Request / Response
  MimiRequest,
  MimiResponse,

  // Handlers
  RequestHandler,   // (req, res, next) => void | Promise<void>
  ErrorHandler,     // (err, req, res, next) => void  — 4-arg error middleware
  AppErrorHandler,  // (err, req, res) => void | Promise<void>  — for setErrorHandler
  NextFunction,     // (err?: Error | string) => void
  Middleware,       // RequestHandler | ErrorHandler

  // Routing
  Route,            // returned by app.route()
  RouteSchema,      // schema object passed to route methods

  // Schema / Validation
  ZodSchema,        // duck-typed interface: { parse, toJSONSchema }

  // Swagger
  SwaggerOptions,
  SecurityScheme,

  // Auth
  TokenPayload,

  // Plugin
  Plugin,           // (app, options) => void | Promise<void>
} from 'mimi.js';
```
