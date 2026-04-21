---
layout: home

hero:
  name: "mimi.js"
  text: "Node.js framework built for speed"
  tagline: Express-compatible · works with JavaScript & TypeScript · batteries included
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
    details: 89,504 req/s on simple routes vs Express's 20,414 — and stays flat at 88,305 req/s even with 50 routes registered.

  - icon: 🗂️
    title: Auto Route Loading
    details: Drop files into a routes/ folder and they load automatically — no import lists, no manual wiring. Works with CommonJS and ES Modules.

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

## Quick Start

```bash
npm install mimi.js
```

```ts
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

```bash
node server.ts
```

---

## Auto Route Loading

The biggest time-saver in mimi.js. Create a `routes/` folder and drop in route files — they are automatically discovered and mounted at startup.

```
my-app/
├── server.ts
└── routes/
    ├── users.ts     ← loaded automatically
    ├── posts.ts     ← loaded automatically
    └── auth.ts      ← loaded automatically
```

```ts
// routes/users.ts
import type { MimiApp } from 'mimi.js';

export default function (app: MimiApp) {
  app.get('/users', (req, res) => res.json({ users: [] }));
  app.post('/users', (req, res) => res.status(201).json(req.body));
}
```

```ts
// server.ts — nothing to import, routes load themselves
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json());
app.listen(3000);
```

[Learn more about Route Loading →](/guide/route-loader)

---

## Performance

Benchmarked: single Node.js process · 100 concurrent connections · 10s (autocannon)

| Framework | Simple route | 50-route app | Memory |
|---|---|---|---|
| Express 4 | 20,414 req/s | 19,704 req/s | 136 MB |
| Fastify 5 | 94,060 req/s | 94,275 req/s | 93 MB |
| **mimi.js v2** | **89,504 req/s** | **88,305 req/s** | **96 MB** |

</div>
