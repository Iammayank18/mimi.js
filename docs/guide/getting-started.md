---
title: Getting Started
outline: deep
---

# Getting Started

## Installation

```bash
npm install mimi.js
```

mimi.js ships TypeScript declarations — no separate `@types/mimi.js` package is needed.

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

## Next Steps

- **[Routing](./routing)** — path parameters, query strings, route grouping
- **[Middleware](./middleware)** — built-in middleware and writing your own
- **[Authentication](./auth)** — JWT, bcrypt, protected routes
- **[Database](./database)** — MongoDB and SQLite integration
