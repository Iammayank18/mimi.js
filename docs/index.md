---
title: Home
layout: home
nav_order: 1
---

# mimi.js

A production-ready Node.js web framework — Express-compatible, TypeScript-first, built for speed.

```bash
npm install mimi.js
```

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

## Performance

Benchmarked against a single Node.js process, 100 concurrent connections, 10s duration (autocannon).

| Framework | Simple route | 50-route app | Memory |
|-----------|-------------|--------------|--------|
| Express 4 | 20,530 req/s | 19,525 req/s | 136 MB |
| Fastify 5 | 95,322 req/s | 93,204 req/s | 92 MB |
| **mimi.js v2** | **86,804 req/s** | 42,992 req/s¹ | **118 MB** |

> ¹ Radix trie router ships in v2.1 and brings 50-route throughput to ~90k req/s.

mimi.js is **4.2× faster than Express** and within 9% of Fastify on simple routes — while shipping auth, database adapters, and Swagger documentation out of the box.

---

## Features at a Glance

- **Express-compatible routing** — `app.get`, `app.post`, `app.use`, `Router` — migrate route by route
- **TypeScript-first** — ships its own declarations, no `@types/*` needed
- **Built-in JWT auth** — `generateToken`, `verifyToken`, `authMiddleware` in one import
- **Password hashing** — bcrypt-powered `hashPassword` / `comparePassword`
- **MongoDB & SQLite adapters** — singleton managers, zero boilerplate
- **Auto Swagger UI** — JSDoc comments become `/api-docs` automatically
- **Batteries-included middleware** — CORS, security headers, body parsing, static files, request logging
- **Auto route loader** — drop files in `routes/` and they're registered automatically
- **Plugin system** — `app.register(plugin, options)` for async-safe extensions
- **Async handler support** — `async (req, res) => {}` just works

---

## Getting Started

→ [Installation & First App](./getting-started)  
→ [Routing](./routing)  
→ [Middleware](./middleware)  
→ [Authentication](./auth)  
→ [Database](./database)  
→ [Swagger Docs](./swagger)  
→ [Full API Reference](./api-reference)  
→ [Changelog](./changelog)
