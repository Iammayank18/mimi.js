<div align="center">
  <img src="https://github.com/user-attachments/assets/6bb183ae-7ec1-4da9-95f2-85064f4deda0" alt="mimi.js Logo" width="100" height="100">
  <h1>mimi.js</h1>
  <p>A production-ready Node.js web framework — Express-compatible, TypeScript-first, built for speed.</p>

  [![npm version](https://img.shields.io/npm/v/mimi.js)](https://www.npmjs.com/package/mimi.js)
  [![license](https://img.shields.io/npm/l/mimi.js)](LICENSE)
  [![node](https://img.shields.io/node/v/mimi.js)](package.json)
</div>

---

## Why mimi.js?

| | Express 4 | Fastify 5 | **mimi.js v2** |
|---|---|---|---|
| Simple route (req/s) | 20,414 | 94,060 | **89,504** |
| 50-route app (req/s) | 19,704 | 94,275 | **88,305** |
| Memory (RSS) | 136 MB | 93 MB | **96 MB** |
| TypeScript | DefinitelyTyped | First-class | **First-class** |
| Built-in auth | ✗ | plugin | **✓ JWT + bcrypt** |
| Built-in database | ✗ | ✗ | **✓ MongoDB + SQLite** |
| Auto Swagger docs | ✗ | plugin | **✓** |

> Benchmarks: single process, 100 connections, autocannon 10s.

---

## Installation

```bash
npm install mimi.js
```

## Quick Start

```typescript
import mimi from 'mimi.js';

const app = mimi();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from mimi.js!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

---

## Features

- **Express-compatible API** — migrate route by route, no rewrite required
- **TypeScript-first** — `req.body`, `req.params`, `req.query` fully typed
- **JWT authentication** — `generateToken`, `verifyToken`, `authMiddleware` built in
- **Password hashing** — bcrypt-powered `hashPassword` / `comparePassword`
- **MongoDB & SQLite** — singleton managers with zero boilerplate
- **Auto Swagger UI** — JSDoc comments → `/api-docs` with no extra config
- **Built-in CORS, security headers, static files** — batteries included
- **Auto route loader** — drop files in `routes/` and they're registered automatically
- **Async handler support** — `async (req, res) => {}` just works, errors forwarded automatically

---

## Routing

```typescript
import mimi, { Router } from 'mimi.js';

const app = mimi();

// Direct methods
app.get('/users', (req, res) => res.json({ users: [] }));
app.post('/users', (req, res) => res.status(201).json({ created: true }));
app.put('/users/:id', (req, res) => res.json({ id: req.params.id }));
app.delete('/users/:id', (req, res) => res.sendStatus(204));

// Router for grouping
const api = new Router();
api.get('/status', (_req, res) => res.json({ ok: true }));
app.use('/api', api); // GET /api/status

app.listen(3000);
```

---

## Middleware

```typescript
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());           // parse application/json bodies
app.use(cors());           // CORS headers
app.use(security());       // security headers (CSP, X-Frame-Options, etc.)
app.use(requestLogger);    // structured request logs

app.get('/', (_req, res) => res.json({ hello: 'world' }));

app.listen(3000);
```

---

## Authentication

```typescript
import mimi, {
  hashPassword,
  comparePassword,
  generateToken,
  authMiddleware,
} from 'mimi.js';

const app = mimi();
app.use(json());

const users: { id: number; email: string; password: string }[] = [];

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const hashed = await hashPassword(password);
  const user = { id: Date.now(), email, password: hashed };
  users.push(user);
  res.status(201).json({ id: user.id, email });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = users.find((u) => u.email === email);
  if (!user || !(await comparePassword(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = generateToken({ id: user.id, email: user.email });
  res.json({ token });
});

// Protected route — requires Authorization: Bearer <token>
app.get('/me', authMiddleware, (req, res) => {
  res.json({ user: (req as any).user });
});

app.listen(3000);
```

> Set `JWT_SECRET` in your environment: `JWT_SECRET=your-secret node app.js`

---

## Database

### MongoDB

```bash
npm install mongoose
```

```typescript
import mimi, { mongodbManager } from 'mimi.js';
import { Schema, model } from 'mongoose';

const app = mimi();

await mongodbManager.connect('mongodb://localhost:27017/mydb');

const UserSchema = new Schema({ name: String, email: String });
const User = model('User', UserSchema);

app.get('/users', async (_req, res) => {
  const users = await User.find();
  res.json(users);
});

app.listen(3000);
```

### SQLite

```bash
npm install sequelize sqlite3
```

```typescript
import mimi, { SQLiteManager } from 'mimi.js';
import { DataTypes } from 'sequelize';

const app = mimi();
const db = new SQLiteManager('./data.sqlite');

await db.connect();
const User = db.instance.define('User', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
});
await User.sync();

app.get('/users', async (_req, res) => {
  const users = await User.findAll();
  res.json(users);
});

app.listen(3000);
```

---

## Swagger Documentation

```typescript
import mimi, { setupSwagger } from 'mimi.js';

const app = mimi();

setupSwagger(app, {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'API built with mimi.js',
  },
});

/**
 * GET /users
 * @summary List all users
 * @return {object[]} 200 - Array of users
 */
app.get('/users', (_req, res) => res.json([]));

app.listen(3000);
// Docs available at http://localhost:3000/api-docs
```

---

## Auto Route Loader

Files placed in a `routes/` directory are loaded automatically at startup:

```
my-api/
├── routes/
│   ├── users.js      ← loaded as /users (you set the path inside)
│   └── products.js
├── app.js
└── package.json
```

```javascript
// routes/users.js
module.exports = function (app) {
  app.get('/users', (_req, res) => res.json([]));
};
```

---

## Plugin System

```typescript
import mimi from 'mimi.js';
import type { Plugin } from 'mimi.js';

const rateLimitPlugin: Plugin = (app, options) => {
  const limit = (options.limit as number) ?? 100;
  const counts = new Map<string, number>();

  app.use((req, res, next) => {
    const ip = req.socket?.remoteAddress ?? 'unknown';
    const count = (counts.get(ip) ?? 0) + 1;
    counts.set(ip, count);
    if (count > limit) return res.status(429).json({ error: 'Too Many Requests' });
    next();
  });
};

const app = mimi();
app.register(rateLimitPlugin, { limit: 50 });
app.listen(3000);
```

---

## API Reference

### `mimi()` → `MimiApp`

Creates a new application instance.

### HTTP Methods

All methods return the app for chaining.

```typescript
app.get(path, ...handlers)
app.post(path, ...handlers)
app.put(path, ...handlers)
app.patch(path, ...handlers)
app.delete(path, ...handlers)
app.head(path, ...handlers)
app.options(path, ...handlers)
app.all(path, ...handlers)   // matches any method
```

### `app.use([path], ...middleware)`

Mounts middleware globally or at a path prefix.

### `app.route(path)` → `Route`

Returns a route object for chaining multiple methods on the same path.

```typescript
app.route('/users')
  .get(listUsers)
  .post(createUser);
```

### `app.listen(port, [callback])` → `http.Server`

Starts the HTTP server.

### `app.register(plugin, [options])` → `MimiApp | Promise<MimiApp>`

Registers a plugin. Supports async plugins.

### Request (`req`)

| Property | Type | Description |
|----------|------|-------------|
| `req.params` | `Record<string, string>` | Route parameters (`/users/:id` → `{ id }`) |
| `req.query` | `Record<string, string>` | Query string (`?page=2` → `{ page: '2' }`) |
| `req.body` | `unknown` | Parsed request body (requires `json()` or `urlencoded()` middleware) |
| `req.path` | `string` | URL pathname without query string |
| `req.hostname` | `string` | `Host` header value (without port) |
| `req.ip` | `string` | Remote client IP address |
| `req.locals` | `Record<string, unknown>` | Per-request storage for middleware |
| `req.get(name)` | `string \| undefined` | Get a request header by name |
| `req.is(type)` | `string \| false` | Check `Content-Type` against a mime type |

### Response (`res`)

| Method | Description |
|--------|-------------|
| `res.status(code)` | Set HTTP status code, returns `res` for chaining |
| `res.json(obj)` | Send JSON response with `Content-Type: application/json` |
| `res.send(body)` | Send response — auto-detects type (Buffer, object, string) |
| `res.sendStatus(code)` | Send status code with its text as the body |
| `res.redirect(url, [status])` | Redirect (default 302) |
| `res.set(field, value)` | Set response header |
| `res.type(contentType)` | Set `Content-Type` header |

### Middleware Factories

| Export | Description |
|--------|-------------|
| `json(options?)` | Parse `application/json` request bodies |
| `urlencoded(options?)` | Parse `application/x-www-form-urlencoded` bodies |
| `cors(options?)` | CORS headers with configurable origin/methods |
| `security(options?)` | Security headers (CSP, X-Frame-Options, etc.) |
| `serveStatic(root, options?)` | Serve static files from a directory |
| `requestLogger` | Log method, URL, status, and response time |
| `customParser` | Parses common content types with raw-body |

### Auth Exports

| Export | Description |
|--------|-------------|
| `hashPassword(password, [saltRounds])` | Hash a password with bcrypt |
| `comparePassword(password, hash)` | Compare a plain password to a bcrypt hash |
| `generateToken(payload, [expiresIn])` | Sign a JWT with `JWT_SECRET` |
| `verifyToken(token)` | Verify and decode a JWT |
| `authMiddleware` | Express-style middleware — attaches decoded payload to `req.user` |

### Database Exports

| Export | Description |
|--------|-------------|
| `mongodbManager` | Singleton mongoose wrapper — `connect(uri)`, `disconnect()`, `connection` |
| `SQLiteManager` | Sequelize + sqlite3 wrapper — `connect()`, `disconnect()`, `instance` |

---

## TypeScript

mimi.js ships its own type declarations — no `@types/*` package needed.

```typescript
import mimi from 'mimi.js';
import type { MimiRequest, MimiResponse, RequestHandler, Plugin } from 'mimi.js';

const requireJson: RequestHandler = (req, res, next) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }
  next();
};

const app = mimi();
app.post('/data', requireJson, async (req, res) => {
  const body = req.body as { name: string };
  res.json({ received: body.name });
});
```

---

## Documentation

Full user guide, API reference, and changelog: **[iammayank18.github.io/mimi.js](https://iammayank18.github.io/mimi.js)**

## Contributing

Issues and pull requests welcome — [github.com/Iammayank18/mimi.js](https://github.com/Iammayank18/mimi.js)

## License

ISC
