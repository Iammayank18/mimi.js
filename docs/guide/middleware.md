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

```typescript
import mimi, { json, cors, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());          // 1st — parses body
app.use(cors());          // 2nd — adds CORS headers
app.use(requestLogger);   // 3rd — logs the request

app.get('/ping', (req, res) => res.json({ ok: true }));

app.listen(3000);
```

Order matters — each middleware runs in the order it is registered.

---

## Built-in Middleware

mimi.js ships 7 production-ready middleware factories.

### `json(opts?)`

Parses JSON request bodies and populates `req.body`. Skips GET, HEAD, OPTIONS requests automatically.

```typescript
import { json } from 'mimi.js';

app.use(json());

// With options
app.use(json({ limit: '5mb' }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `limit` | `string` | `'1mb'` | Maximum request body size |

Returns `400 Bad Request` if the body is malformed JSON.

---

### `urlencoded(opts?)`

Parses URL-encoded form bodies (`application/x-www-form-urlencoded`) and populates `req.body`.

```typescript
import { urlencoded } from 'mimi.js';

app.use(urlencoded({ extended: true }));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `extended` | `boolean` | `true` | `true` uses `qs` (nested objects); `false` uses `URLSearchParams` (flat) |
| `limit` | `string` | `'1mb'` | Maximum body size |

---

### `cors(opts?)`

Adds Cross-Origin Resource Sharing headers. Automatically handles preflight `OPTIONS` requests.

```typescript
import { cors } from 'mimi.js';

// Allow all origins
app.use(cors());

// Allow specific origin
app.use(cors({ origin: 'https://myapp.com' }));

// Allow multiple origins
app.use(cors({ origin: ['https://myapp.com', 'https://admin.myapp.com'] }));

// Dynamic origin — return the origin or false to deny
app.use(cors({
  origin: (origin) => {
    return origin.endsWith('.myapp.com') ? origin : false;
  },
  credentials: true,
}));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `origin` | `string \| string[] \| (origin: string) => string \| false` | `'*'` | Allowed origins |
| `methods` | `string[]` | `['GET','HEAD','PUT','PATCH','POST','DELETE']` | Allowed HTTP methods |
| `allowedHeaders` | `string[]` | mirrors `Access-Control-Request-Headers` | Headers the client may send |
| `exposedHeaders` | `string[]` | `[]` | Headers the client can read from the response |
| `credentials` | `boolean` | `false` | Set `Access-Control-Allow-Credentials: true` |
| `maxAge` | `number` | — | Seconds to cache the preflight response |

---

### `security(opts?)`

Sets security-related HTTP response headers. All headers are enabled by default; pass `false` to disable individual ones.

```typescript
import { security } from 'mimi.js';

app.use(security());

// Disable specific headers
app.use(security({
  contentSecurityPolicy: false,          // disable CSP
  xFrameOptions: 'DENY',                 // override default SAMEORIGIN
}));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `contentSecurityPolicy` | `false \| string` | `"default-src 'self'"` | `Content-Security-Policy` header value |
| `xFrameOptions` | `false \| string` | `'SAMEORIGIN'` | `X-Frame-Options` header value |
| `xContentTypeOptions` | `false` | enabled | Sends `X-Content-Type-Options: nosniff` |
| `xXssProtection` | `false` | enabled | Sends `X-XSS-Protection: 0` |
| `dnsPrefetchControl` | `false` | enabled | Sends `X-DNS-Prefetch-Control: off` |
| `permittedCrossDomainPolicies` | `false \| string` | `'none'` | `X-Permitted-Cross-Domain-Policies` |
| `downloadOptions` | `false` | enabled | Sends `X-Download-Options: noopen` |
| `removePoweredBy` | `false` | enabled | Removes `X-Powered-By` header |

---

### `serveStatic(root, opts?)`

Serves files from a directory. Only handles GET and HEAD requests.

```typescript
import { serveStatic } from 'mimi.js';
import path from 'path';

app.use(serveStatic(path.join(__dirname, 'public')));

// With options
app.use('/assets', serveStatic('./static', {
  maxAge: 86400,     // 1 day cache
  index: 'index.html',
}));
```

| Option | Type | Default | Description |
|---|---|---|---|
| `maxAge` | `number \| string` | `0` | Browser cache max-age in seconds (or string like `'1d'`) |
| `index` | `string \| false` | `'index.html'` | Directory index file; `false` to disable |
| `dotfiles` | `'allow' \| 'deny' \| 'ignore'` | `'ignore'` | How to handle dot-files |
| `etag` | `boolean` | `true` | Generate ETag headers |
| `lastModified` | `boolean` | `true` | Set `Last-Modified` header |

---

### `requestLogger`

Logs each request's method, URL, status code, and elapsed time using pino (structured JSON). Not a factory — import directly:

```typescript
import { requestLogger } from 'mimi.js';

app.use(requestLogger);
```

Log output (JSON):

```json
{ "level": 30, "method": "GET", "url": "/users/1", "status": 200, "ms": 4 }
```

Control log level with `LOG_LEVEL` environment variable (default `info`).

---

### `customParser`

Parses `application/custom` content-type bodies and sets `req.body = {}`. Useful as a starting point for implementing your own content-type handler.

```typescript
import { customParser } from 'mimi.js';

app.use(customParser);
```

---

## Writing Custom Middleware

Any `(req, res, next)` function is valid middleware:

```typescript
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

Use `req.locals` to pass arbitrary data between middleware and route handlers without modifying `req` types:

```typescript
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

Apply middleware only to specific routes by passing it as an extra handler argument:

```typescript
const adminOnly: RequestHandler = (req, res, next) => {
  if (req.locals.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.get('/admin/stats', adminOnly, (req, res) => {
  res.json({ users: 1000 });
});
```

Or mount it at a path prefix:

```typescript
app.use('/admin', adminOnly);

app.get('/admin/stats', (req, res) => res.json({ ok: true }));
app.get('/admin/users', (req, res) => res.json({ users: [] }));
```

---

## Conditional Middleware

Skip middleware for specific routes using an early return:

```typescript
const skipLogging: RequestHandler = (req, res, next) => {
  if (req.url === '/health') return next(); // skip for health check
  requestLogger(req, res, next);
};

app.use(skipLogging);
```

---

## Error Middleware

A 4-argument handler `(err, req, res, next)` is recognized as an error handler. Place it **after** all routes:

```typescript
import type { ErrorHandler } from 'mimi.js';

const errorHandler: ErrorHandler = (err, req, res, next) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message, path: req.url });
};

// Last in the chain
app.use(errorHandler);
```

::: tip
For global error handling across your entire app, prefer [`app.setErrorHandler()`](/guide/error-handling#app-seterrorhandler-fn) — it's simpler and doesn't need to be placed last.
:::
