---
layout: home

hero:
  name: "mimi.js"
  text: "Node.js framework built for speed"
  tagline: Express-compatible · TypeScript-first · batteries included
  image:
    src: https://github.com/user-attachments/assets/6bb183ae-7ec1-4da9-95f2-85064f4deda0
    alt: mimi.js
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/Iammayank18/mimi.js

features:
  - icon: ⚡
    title: 4× Faster Than Express
    details: 86,804 req/s on simple routes vs Express's 20,530. Built on a lean HTTP pipeline with zero unnecessary overhead.

  - icon: 🔷
    title: TypeScript-First
    details: Ships its own declarations — no @types/* needed. req.params, req.query, and req.body are typed without extra config.

  - icon: 🔐
    title: Built-in Auth
    details: JWT generation, verification, and authMiddleware out of the box. bcrypt password hashing with a single import.

  - icon: 🗄️
    title: Database Adapters
    details: Singleton managers for MongoDB (Mongoose) and SQLite (Sequelize). Connect in one line, model in two.

  - icon: 📖
    title: Auto Swagger Docs
    details: Add JSDoc comments to your routes — Swagger UI appears at /api-docs automatically. No extra config.

  - icon: 🧩
    title: Plugin System
    details: Extend the framework with app.register(plugin, options). Supports async plugins for database connections and third-party setup.
---

<div class="vp-doc" style="max-width:900px;margin:0 auto;padding:48px 24px 0">

## Performance

Benchmarked: single Node.js process · 100 concurrent connections · 10s (autocannon)

| Framework | Simple route | 50-route app | Memory |
|---|---|---|---|
| Express 4 | 20,530 req/s | 19,525 req/s | 136 MB |
| Fastify 5 | 95,322 req/s | 93,204 req/s | 92 MB |
| **mimi.js v2** | **86,804 req/s** | 42,992 req/s¹ | **118 MB** |

> ¹ Radix trie router ships in v2.1 — brings 50-route performance to ~90k req/s.

## Quick Start

```bash
npm install mimi.js
```

```typescript
import mimi, { json, cors } from 'mimi.js';

const app = mimi();

app.use(json());
app.use(cors());

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from mimi.js!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

</div>
