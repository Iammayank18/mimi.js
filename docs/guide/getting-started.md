---
title: Getting Started
outline: deep
---

# Getting Started

mimi.js is a Node.js web framework with an Express-compatible API. It works with JavaScript and TypeScript — no build step needed.

## Installation

```bash
npm install mimi.js
```

Requires **Node.js 22.6 or later**.

---

## Hello World

Create `server.ts`:

```ts
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
node server.ts
```

Visit `http://localhost:3000` — you'll get:

```json
{ "message": "Hello from mimi.js!" }
```

---

## Your First Routes

`req.params` captures URL segments, `req.query` captures query string values:

```ts
import mimi from 'mimi.js';

const app = mimi();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id });
});

app.get('/search', (req, res) => {
  const { q = '', page = '1' } = req.query;
  res.json({ query: q, page: Number(page) });
});

app.post('/users', (req, res) => {
  res.status(201).json({ created: req.body });
});

app.listen(3000);
```

---

## Adding Middleware

Call `app.use()` before your routes:

```ts
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());          // parse JSON bodies
app.use(cors());          // CORS headers
app.use(security());      // security headers
app.use(requestLogger);   // log requests

app.get('/ping', (req, res) => res.json({ ok: true }));
app.post('/echo', (req, res) => res.json(req.body));

app.listen(3000);
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes (for auth) | Secret key for signing and verifying JWT tokens |
| `LOG_LEVEL` | No | pino log level: `trace`, `debug`, `info`, `warn`, `error` (default: `info`) |

```bash
# .env
JWT_SECRET=your-super-secret-key
LOG_LEVEL=info
```

---

## Next Steps

| Topic | What you'll learn |
|---|---|
| [Route Loader](/guide/route-loader) | Auto-load route files from `routes/` — zero wiring |
| [Routing](/guide/routing) | Parameters, chaining, async handlers, 404s |
| [Middleware](/guide/middleware) | All built-in middleware with full options |
| [Error Handling](/guide/error-handling) | Custom error responses and `setErrorHandler` |
| [Authentication](/guide/auth) | JWT generation, verification, protected routes |
| [Database](/guide/database) | MongoDB and SQLite adapters |
| [Plugins](/guide/plugins) | Extending the framework with plugins |
| [Testing](/guide/testing) | Testing routes and middleware with vitest |
