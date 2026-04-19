---
title: Getting Started
parent: Guide
nav_order: 1
---

# Getting Started
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Requirements

- Node.js 16 or higher
- npm 7 or higher

---

## Installation

```bash
npm install mimi.js
```

mimi.js ships TypeScript declarations — no separate `@types/mimi.js` package is needed.

---

## Your First App

### CommonJS

```javascript
// app.js
const mimi = require('mimi.js');

const app = mimi();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

Run it:

```bash
node app.js
```

### TypeScript

```typescript
// app.ts
import mimi from 'mimi.js';

const app = mimi();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

Run it:

```bash
npx ts-node app.ts
```

### ES Modules

```javascript
// app.mjs
import mimi from 'mimi.js';

const app = mimi();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

app.listen(3000);
```

---

## Adding Middleware

A typical app with body parsing, CORS, and logging:

```typescript
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi();

// Parse JSON request bodies
app.use(json());

// Enable CORS
app.use(cors({ origin: 'https://myapp.com' }));

// Security headers
app.use(security());

// Request logs
app.use(requestLogger);

app.get('/users', (_req, res) => res.json({ users: [] }));

app.post('/users', (req, res) => {
  const { name } = req.body as { name: string };
  res.status(201).json({ name });
});

app.listen(3000);
```

---

## Auto Route Loader

Drop route files in a `routes/` directory next to your entry point — they are loaded automatically when the app starts.

```
my-api/
├── routes/
│   ├── users.js
│   └── products.js
├── app.js
└── package.json
```

```javascript
// routes/users.js
module.exports = function (app) {
  app.get('/users', (_req, res) => res.json([]));
  app.post('/users', (req, res) => res.status(201).json(req.body));
};
```

The route file receives the `app` instance as its only argument. Anything you register inside is mounted globally.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | When using `generateToken` or `verifyToken` | Secret key for signing/verifying JWTs |
| `LOG_LEVEL` | No (default: `info`) | Logging level — `debug`, `info`, `warn`, `error` |

Use a `.env` file with the built-in dotenv support:

```bash
# .env
JWT_SECRET=supersecretkey
LOG_LEVEL=debug
```

mimi.js loads `.env` automatically via `dotenv/config` when imported.

---

## TypeScript Setup

mimi.js works with any standard TypeScript configuration. A minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

All request and response types are available as named imports:

```typescript
import type {
  MimiApp,
  MimiRequest,
  MimiResponse,
  RequestHandler,
  ErrorHandler,
  NextFunction,
  Plugin,
} from 'mimi.js';
```

---

## Next Steps

- **[Routing](./routing)** — path parameters, query strings, route grouping
- **[Middleware](./middleware)** — built-in middleware and writing your own
- **[Authentication](./auth)** — JWT, bcrypt, protected routes
- **[Database](./database)** — MongoDB and SQLite integration
