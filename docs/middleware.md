---
title: Middleware
parent: Guide
nav_order: 3
---

# Middleware
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Built-in Middleware

Import from `mimi.js` directly — no extra packages needed.

### `json(options?)`

Parses `application/json` request bodies and populates `req.body`.

```typescript
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json({ limit: '1mb' }));

app.post('/data', (req, res) => {
  console.log(req.body); // parsed object
  res.json({ received: true });
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | `string \| number` | `'100kb'` | Max body size |

### `urlencoded(options?)`

Parses `application/x-www-form-urlencoded` bodies (HTML form submissions).

```typescript
app.use(urlencoded({ extended: true }));
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extended` | `boolean` | `false` | Use `qs` for nested objects |
| `limit` | `string \| number` | `'100kb'` | Max body size |

### `cors(options?)`

Adds CORS headers to all responses.

```typescript
import { cors } from 'mimi.js';

// Allow all origins
app.use(cors());

// Allow a specific origin
app.use(cors({ origin: 'https://myapp.com' }));

// Allow multiple origins
app.use(cors({ origin: ['https://myapp.com', 'https://admin.myapp.com'] }));

// Dynamic origin function
app.use(cors({
  origin: (requestOrigin) => {
    if (requestOrigin.endsWith('.myapp.com')) return requestOrigin;
    return false; // block
  },
  credentials: true,
  maxAge: 3600,
}));
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `string \| string[] \| fn` | `'*'` | Allowed origin(s) |
| `methods` | `string[]` | All methods | Allowed HTTP methods |
| `allowedHeaders` | `string[]` | Mirrors request | Allowed request headers |
| `exposedHeaders` | `string[]` | `[]` | Headers exposed to browser |
| `credentials` | `boolean` | `false` | Allow cookies/auth headers |
| `maxAge` | `number` | — | Preflight cache duration (seconds) |

### `security(options?)`

Sets security-related HTTP response headers.

```typescript
import { security } from 'mimi.js';

app.use(security());

// Disable specific headers
app.use(security({
  contentSecurityPolicy: false,
  xFrameOptions: 'ALLOW-FROM https://trusted.com',
}));
```

| Option | Default value set | Description |
|--------|-------------------|-------------|
| `contentSecurityPolicy` | `"default-src 'self'"` | Set `Content-Security-Policy` |
| `xFrameOptions` | `'SAMEORIGIN'` | Set `X-Frame-Options` |
| `xContentTypeOptions` | `'nosniff'` | Set `X-Content-Type-Options` |
| `xXssProtection` | `'0'` | Set `X-XSS-Protection` |
| `dnsPrefetchControl` | `'off'` | Set `X-DNS-Prefetch-Control` |
| `removePoweredBy` | removes header | Remove `X-Powered-By` |

Pass `false` to disable any individual header.

### `serveStatic(root, options?)`

Serves files from a directory.

```typescript
import { serveStatic } from 'mimi.js';

app.use(serveStatic('./public'));

// Serve at a specific path
app.use('/assets', serveStatic('./public/assets'));
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `index` | `string \| false` | `'index.html'` | Directory index filename |
| `maxAge` | `number` | `0` | Cache-Control max-age (ms) |

### `requestLogger`

Logs each request: method, URL, status code, and response time.

```typescript
import { requestLogger } from 'mimi.js';

app.use(requestLogger);
// Output: {"method":"GET","url":"/users","status":200,"ms":3}
```

Set `LOG_LEVEL=debug` in your environment for more verbose output.

### `customParser`

Parses raw request bodies for a range of content types using `raw-body` under the hood.

```typescript
import { customParser } from 'mimi.js';

app.use(customParser);
```

---

## Writing Custom Middleware

Any function with the signature `(req, res, next)` is valid middleware:

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

### Attaching Data to `req.locals`

Use `req.locals` to pass data between middleware without augmenting `req` types:

```typescript
const attachUser: RequestHandler = async (req, res, next) => {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  if (token) {
    req.locals.user = await getUserFromToken(token);
  }
  next();
};

app.use(attachUser);

app.get('/me', (req, res) => {
  res.json({ user: req.locals.user ?? null });
});
```

### Error Middleware

Define a 4-argument handler to catch errors. Must be placed **after** all routes:

```typescript
import type { ErrorHandler } from 'mimi.js';

const errorHandler: ErrorHandler = (err, req, res, next) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({
    error: err.message,
    path: req.url,
  });
};

app.use(errorHandler);
```

### Scoped Middleware

Apply middleware to specific routes by passing it as a handler argument:

```typescript
function adminOnly(req: any, res: any, next: any) {
  if (req.locals.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

app.get('/admin/stats', adminOnly, (req, res) => {
  res.json({ users: 1000 });
});
```
