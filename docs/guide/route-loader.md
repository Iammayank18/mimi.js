---
title: Route Loader
outline: deep
---

# Route Loader

The route loader automatically discovers and mounts every file inside your `routes/` folder. No import lists, no manual wiring — just drop a file and it's live.

---

## How It Works

When your app starts, mimi.js:

1. Looks for a `routes/` folder in your project root
2. Reads every `.js` and `.ts` file inside it
3. Calls each file's exported function with the `app` instance
4. Your routes are registered — automatically

If the `routes/` folder doesn't exist, the loader silently skips and your app starts normally.

---

## File Structure

```
my-app/
├── server.ts
├── package.json
└── routes/
    ├── users.ts       ← auto-loaded
    ├── posts.ts       ← auto-loaded
    └── auth.ts        ← auto-loaded
```

---

## Writing a Route File

Each file exports a default function that receives the `app` instance:

```ts
// routes/users.ts
import type { MimiApp } from 'mimi.js';

export default function (app: MimiApp) {
  app.get('/users', (req, res) => {
    res.json({ users: [] });
  });

  app.post('/users', (req, res) => {
    res.status(201).json(req.body);
  });

  app.get('/users/:id', (req, res) => {
    res.json({ id: req.params.id });
  });
}
```

---

## Server Setup

Your `server.ts` stays minimal — no route imports needed:

```ts
import mimi, { json, cors } from 'mimi.js';

const app = mimi(); // routes/ loaded here automatically

app.use(json());
app.use(cors());

app.listen(3000, () => {
  console.log('Server on http://localhost:3000');
});
```

Run:

```bash
node server.ts
```

---

## Using Routers in Route Files

Route files can mount a `Router` for sub-path grouping:

```ts
// routes/api.ts
import { Router } from 'mimi.js';
import type { MimiApp } from 'mimi.js';

export default function (app: MimiApp) {
  const router = new Router();

  router.get('/status', (req, res) => res.json({ ok: true }));
  router.get('/version', (req, res) => res.json({ version: '1.0.0' }));

  app.use('/api', router);
}
```

---

## Benefits

**No boilerplate** — adding a route file is one step, not three (create, import, mount).

**Natural code splitting** — each domain (users, posts, auth) lives in its own file from day one.

**Scales without friction** — a 2-route app and a 200-route app have identical `server.ts` files.

---

## When to Use `app.use()` Instead

The route loader is ideal for most projects. You may prefer manual `app.use()` when:

- You need strict ordering guarantees across route files
- You're building a library or framework on top of mimi.js
- Your project uses a non-standard folder structure

In those cases, simply don't create a `routes/` folder — the loader skips silently.
