---
title: Getting Started
outline: deep
---

# Getting Started

mimi.js is a TypeScript-first Node.js web framework with an Express-compatible API. It ships its own type declarations, includes middleware for the most common production needs, and performs at near-Fastify throughput out of the box.

## Installation

```bash
npm install mimi.js
```

Requires **Node.js 18 or later**. No separate `@types/mimi.js` package needed — declarations are bundled.

---

## Hello World

The smallest possible server:

```typescript
import mimi from 'mimi.js';

const app = mimi();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from mimi.js!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

Run it:

```bash
npx ts-node server.ts
```

Visit `http://localhost:3000` — you'll get:

```json
{ "message": "Hello from mimi.js!" }
```

---

## Your First Routes

Routes are registered with HTTP method names. `req.params` captures URL segments and `req.query` captures query string values:

```typescript
import mimi from 'mimi.js';

const app = mimi();

// GET /users → list all users
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// GET /users/42 → get user by ID
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ userId: id });
});

// GET /search?q=hello&page=2
app.get('/search', (req, res) => {
  const { q, page = '1' } = req.query;
  res.json({ query: q, page: Number(page) });
});

// POST /users → create user
app.post('/users', (req, res) => {
  const user = req.body as { name: string; email: string };
  // ... save to DB
  res.status(201).json({ created: user });
});

app.listen(3000);
```

---

## Adding Middleware

Middleware runs before your route handlers. Add it with `app.use()` before declaring routes:

```typescript
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi();

// Parse JSON request bodies — populates req.body
app.use(json());

// Allow cross-origin requests
app.use(cors({ origin: 'https://myapp.com', credentials: true }));

// Set security headers (CSP, X-Frame-Options, etc.)
app.use(security());

// Log every request: method, url, status, elapsed ms
app.use(requestLogger);

app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

app.post('/echo', (req, res) => {
  res.json(req.body); // body parsed by json()
});

app.listen(3000);
```

---

## CommonJS and ES Modules

**TypeScript (recommended):**

```typescript
import mimi, { json, cors } from 'mimi.js';
const app = mimi();
```

**CommonJS:**

```javascript
const { default: mimi, json, cors } = require('mimi.js');
const app = mimi();
```

**ES Module (`.mjs` or `"type": "module"`):**

```javascript
import mimi, { json, cors } from 'mimi.js';
const app = mimi();
```

---

## TypeScript Setup

Minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Import types when you need explicit annotations:

```typescript
import type { MimiRequest, MimiResponse, NextFunction, RequestHandler } from 'mimi.js';

const greet: RequestHandler = (req: MimiRequest, res: MimiResponse) => {
  res.json({ hello: req.params.name });
};
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes (for auth) | Secret key used to sign and verify JWT tokens |
| `LOG_LEVEL` | No | pino log level: `trace`, `debug`, `info`, `warn`, `error` (default: `info`) |

Create a `.env` file at your project root:

```bash
JWT_SECRET=your-super-secret-key
LOG_LEVEL=info
```

mimi.js loads `dotenv` automatically — no extra setup required.

---

## Next Steps

| Topic | What you'll learn |
|---|---|
| [Routing](/guide/routing) | Parameters, chaining, async handlers, 404s |
| [Middleware](/guide/middleware) | All built-in middleware with full options |
| [Error Handling](/guide/error-handling) | Custom error responses and `setErrorHandler` |
| [Authentication](/guide/auth) | JWT generation, verification, protected routes |
| [Database](/guide/database) | MongoDB and SQLite adapters |
| [Plugins](/guide/plugins) | Extending the framework with plugins |
| [Testing](/guide/testing) | Testing routes and middleware with vitest |
