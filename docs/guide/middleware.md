---
title: Middleware
outline: deep
---

# Middleware

Middleware are functions that run before your route handlers. They can read and modify `req`/`res`, end the request, or call `next()` to pass control forward.

---

## How Middleware Works

```
Request → middleware 1 → middleware 2 → route handler → Response
```

Register global middleware with `app.use()` **before** your routes:

```ts
import mimi, { json, cors, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());          // 1st — parses body
app.use(cors());          // 2nd — adds CORS headers
app.use(requestLogger);   // 3rd — logs the request

app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(3000);
```

Order matters — middleware runs in registration order.

---

## Built-in Middleware

mimi.js ships 9 production-ready middleware factories.

### `json(opts?)`

Parses JSON request bodies into `req.body`. Skips GET, HEAD, OPTIONS automatically.

```ts
import { json } from 'mimi.js';

app.use(json());
app.use(json({ limit: '5mb' }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `limit` | `string` | `'1mb'` | Maximum request body size |

Returns `400 Bad Request` if the body is malformed JSON.

---

### `urlencoded(opts?)`

Parses URL-encoded form bodies into `req.body`.

```ts
import { urlencoded } from 'mimi.js';

app.use(urlencoded({ extended: true }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `extended` | `boolean` | `true` | `true` uses `qs` (nested objects); `false` uses `URLSearchParams` (flat) |
| `limit` | `string` | `'1mb'` | Maximum body size |

---

### `cors(opts?)`

Adds CORS headers. Handles preflight `OPTIONS` requests automatically.

```ts
import { cors } from 'mimi.js';

app.use(cors());                                         // allow all origins
app.use(cors({ origin: 'https://myapp.com' }));          // specific origin
app.use(cors({
  origin: (origin) => origin.endsWith('.myapp.com') ? origin : false,
  credentials: true,
}));
```

| Option | Type | Default |
|---|---|---|
| `origin` | `string \| string[] \| (origin: string) => string \| false` | `'*'` |
| `methods` | `string[]` | `['GET','HEAD','PUT','PATCH','POST','DELETE']` |
| `allowedHeaders` | `string[]` | mirrors request headers |
| `exposedHeaders` | `string[]` | `[]` |
| `credentials` | `boolean` | `false` |
| `maxAge` | `number` | — |

---

### `security(opts?)`

Sets security-related HTTP response headers. All enabled by default.

```ts
import { security } from 'mimi.js';

app.use(security());
app.use(security({ contentSecurityPolicy: false, xFrameOptions: 'DENY' }));
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

Pass `false` for any option to disable that header.

---

### `serveStatic(root, opts?)`

Serves files from a directory. Handles GET and HEAD only.

```ts
import { serveStatic } from 'mimi.js';
import path from 'path';

app.use(serveStatic(path.join(process.cwd(), 'public')));
app.use('/assets', serveStatic('./static', { maxAge: 86400 }));
```

| Option | Type | Default |
|---|---|---|
| `maxAge` | `number \| string` | `0` |
| `index` | `string \| false` | `'index.html'` |
| `dotfiles` | `'allow' \| 'deny' \| 'ignore'` | `'ignore'` |
| `etag` | `boolean` | `true` |
| `lastModified` | `boolean` | `true` |

---

### `requestLogger`

Logs each request's method, URL, status, and elapsed time using pino. Not a factory — import directly, or let `mimi({ logger: true })` auto-wire it for you.

```ts
import { requestLogger } from 'mimi.js';
app.use(requestLogger);
```

When `requestId()` is mounted upstream, all log lines include `reqId`:

```
10:42:15 INFO  GET /users/1 → 200 (4ms)  { reqId: "a3b2c1d0-...", status: 200, ms: 4 }
```

**Auto-wiring via `mimi({ logger })`** — the preferred approach for most apps:

```ts
const app = mimi({ logger: true });              // auto-wire + detect pretty/JSON from NODE_ENV
const app = mimi({ logger: { pretty: true } });  // force pretty even in production
```

No manual `app.use(requestLogger)` needed when using the `logger` option.

Control the log level with the `LOG_LEVEL` environment variable (default: `info`).

---

### `requestId()`

Assigns a unique ID to every request. Reads the `x-request-id` header if present, generates a UUID v4 otherwise. Sets `req.id` and echoes the ID back as the `x-request-id` response header.

```ts
import { requestId } from 'mimi.js';

app.use(requestId());
```

When `requestLogger` is also active, `req.id` is automatically included in every log line as `reqId`. Useful for correlating logs across multiple services.

Without `requestId()`, nothing breaks — `reqId` is simply absent from logs.

---

### `logError(err, req, statusCode)`

Structured server-side error logger. Use inside `setErrorHandler` or custom error middleware. Never exposes the stack trace to clients — logs it server-side with full context.

```ts
import { logError } from 'mimi.js';

app.setErrorHandler((err, req, res) => {
  const status = (err as any).status ?? 500;
  logError(err, req, status);   // logs reqId, method, url, stack
  res.status(status).json({
    error: status < 500 ? err.message : 'An unexpected error occurred.',
    requestId: req.id,
  });
});
```

| Parameter | Type | Description |
|---|---|---|
| `err` | `Error` | The error to log |
| `req` | `MimiRequest` | The current request (for method, url, reqId) |
| `statusCode` | `number` | HTTP status code to include in the log |

---

### `customParser`

Parses `application/custom` bodies and sets `req.body = {}`. Useful as a base for custom content-type handlers.

```ts
import { customParser } from 'mimi.js';
app.use(customParser);
```

---

## Writing Custom Middleware

Any `(req, res, next)` function is valid middleware:

```ts
import type { RequestHandler } from 'mimi.js';

const timing: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} — ${Date.now() - start}ms`);
  });
  next();
};

app.use(timing);
```

---

## Attaching Data with `req.locals`

Use `req.locals` to pass data between middleware and route handlers without modifying `req` types:

```ts
import type { RequestHandler } from 'mimi.js';

const loadUser: RequestHandler = async (req, res, next) => {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  if (token) {
    req.locals.user = await getUserFromToken(token);
  }
  next();
};

app.use(loadUser);

app.get('/me', (req, res) => {
  const user = req.locals.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user });
});
```

---

## Scoped Middleware

Apply middleware only to specific routes:

```ts
const adminOnly: RequestHandler = (req, res, next) => {
  if (req.locals.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Inline — just this route
app.get('/admin/stats', adminOnly, (req, res) => {
  res.json({ users: 1000 });
});

// Prefix — all /admin routes
app.use('/admin', adminOnly);
```

---

## Conditional Middleware

Skip middleware for specific paths using an early return:

```ts
const skipLogging: RequestHandler = (req, res, next) => {
  if (req.url === '/health') return next();
  requestLogger(req, res, next);
};

app.use(skipLogging);
```

---

## Error Middleware

A 4-argument handler `(err, req, res, next)` is recognized as an error handler. Place it **after all routes**:

```ts
import type { ErrorHandler } from 'mimi.js';

const errorHandler: ErrorHandler = (err, req, res, next) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message, path: req.url });
};

app.use(errorHandler);
```

::: tip
For global error handling, prefer [`app.setErrorHandler()`](/guide/error-handling#app-seterrorhandler-fn) — it's simpler and doesn't need to be placed last.
:::
