---
title: Getting Started
outline: deep
---

# Getting Started

mimi.js is a Node.js web framework that works with plain JavaScript and TypeScript. It has an Express-compatible API, ships with production-ready middleware, and includes a route loader that wires up your `routes/` folder automatically.

## Installation

```bash
npm install mimi.js
```

Requires **Node.js 18 or later**.

---

## Hello World

::: code-group

```js [JavaScript]
import mimi from 'mimi.js';

const app = mimi();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from mimi.js!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

```ts [TypeScript]
import mimi from 'mimi.js';

const app = mimi();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from mimi.js!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

:::

Run it:

```bash
node server.js        # JavaScript (add "type":"module" to package.json)
node dist/server.js   # TypeScript (run tsc first)
```

Visit `http://localhost:3000` — you'll get:

```json
{ "message": "Hello from mimi.js!" }
```

::: tip CommonJS
If your project uses `require()`, import like this:
```js
const { default: mimi } = require('mimi.js');
```
:::

---

## Your First Routes

`req.params` captures URL segments, `req.query` captures query string values:

::: code-group

```js [JavaScript]
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

```ts [TypeScript]
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
  const user = req.body as { name: string; email: string };
  res.status(201).json({ created: user });
});

app.listen(3000);
```

:::

---

## Adding Middleware

Call `app.use()` before your routes:

::: code-group

```js [JavaScript]
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());                                         // parse JSON bodies
app.use(cors({ origin: 'https://myapp.com' }));         // CORS headers
app.use(security());                                     // security headers
app.use(requestLogger);                                  // log requests

app.get('/ping', (req, res) => res.json({ ok: true }));
app.post('/echo', (req, res) => res.json(req.body));

app.listen(3000);
```

```ts [TypeScript]
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi();

app.use(json());
app.use(cors({ origin: 'https://myapp.com' }));
app.use(security());
app.use(requestLogger);

app.get('/ping', (req, res) => res.json({ ok: true }));
app.post('/echo', (req, res) => res.json(req.body));

app.listen(3000);
```

:::

---

## TypeScript Setup

Add a `tsconfig.json`:

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

Compile and run:

```bash
npx tsc && node dist/server.js
```

Import types for explicit annotations:

```ts
import type { RequestHandler } from 'mimi.js';

const greet: RequestHandler = (req, res) => {
  res.json({ hello: req.params.name });
};
```

No separate `@types/mimi.js` needed — type declarations are bundled.

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
