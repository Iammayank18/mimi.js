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

::: code-group

```js [JavaScript]
import mimi, { json, cors, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());          // 1st — parses body
app.use(cors());          // 2nd — adds CORS headers
app.use(requestLogger);   // 3rd — logs the request

app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(3000);
```

```ts [TypeScript]
import mimi, { json, cors, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());
app.use(cors());
app.use(requestLogger);

app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(3000);
```

:::

Order matters — middleware runs in registration order.

---

## Built-in Middleware

mimi.js ships 7 production-ready middleware factories.

### `json(opts?)`

Parses JSON request bodies into `req.body`. Skips GET, HEAD, OPTIONS automatically.

```js
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

Parses URL-encoded form bodies (`application/x-www-form-urlencoded`) into `req.body`.

```js
import { urlencoded } from 'mimi.js';

app.use(urlencoded({ extended: true }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `extended` | `boolean` | `true` | `true` uses `qs` (nested objects); `false` uses `URLSearchParams` (flat) |
| `limit` | `string` | `'1mb'` | Maximum body size |

---

### `cors(opts?)`

Adds Cross-Origin Resource Sharing headers. Handles preflight `OPTIONS` requests automatically.

```js
import { cors } from 'mimi.js';

app.use(cors());                                        // allow all origins
app.use(cors({ origin: 'https://myapp.com' }));        // specific origin
app.use(cors({ origin: ['https://myapp.com', 'https://admin.myapp.com'] }));

// Dynamic origin — return origin or false to deny
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

Sets security-related HTTP response headers. All enabled by default — pass `false` to disable any.

```js
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

---

### `serveStatic(root, opts?)`

Serves files from a directory. Handles GET and HEAD only.

```js
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

Logs each request's method, URL, status, and elapsed time as structured JSON (pino). Not a factory — import directly.

```js
import { requestLogger } from 'mimi.js';
app.use(requestLogger);
```

```json
{ "level": 30, "method": "GET", "url": "/users/1", "status": 200, "ms": 4 }
```

Control log level with `LOG_LEVEL` environment variable (default `info`).

---

### `customParser`

Parses `application/custom` content-type bodies and sets `req.body = {}`. Useful as a starting point for custom parsers.

```js
import { customParser } from 'mimi.js';
app.use(customParser);
```

---

## Writing Custom Middleware

Any `(req, res, next)` function is valid middleware:

::: code-group

```js [JavaScript]
const timing = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} — ${Date.now() - start}ms`);
  });
  next();
};

app.use(timing);
```

```ts [TypeScript]
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

:::

---

## Attaching Data with `req.locals`

Use `req.locals` to pass data between middleware and route handlers:

::: code-group

```js [JavaScript]
const loadUser = async (req, res, next) => {
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

```ts [TypeScript]
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

:::

---

## Scoped Middleware

Apply middleware only to specific routes:

```js
const adminOnly = (req, res, next) => {
  if (req.locals.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Inline — only this route
app.get('/admin/stats', adminOnly, (req, res) => {
  res.json({ users: 1000 });
});

// Prefix — all /admin routes
app.use('/admin', adminOnly);
```

---

## Conditional Middleware

Skip middleware for specific paths:

```js
const skipLogging = (req, res, next) => {
  if (req.url === '/health') return next();
  requestLogger(req, res, next);
};

app.use(skipLogging);
```

---

## Error Middleware

A 4-argument handler `(err, req, res, next)` is recognized as an error handler. Place it **after all routes**:

::: code-group

```js [JavaScript]
// Last in the chain
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message, path: req.url });
});
```

```ts [TypeScript]
import type { ErrorHandler } from 'mimi.js';

const errorHandler: ErrorHandler = (err, req, res, next) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message, path: req.url });
};

app.use(errorHandler);
```

:::

::: tip
For global error handling, prefer [`app.setErrorHandler()`](/guide/error-handling#app-seterrorhandler-fn) — it's simpler and doesn't need to be placed last.
:::
