---
title: Route Loader
outline: deep
---

# Route Loader

The route loader is a zero-config feature that automatically discovers and mounts every file inside your `routes/` folder. No import lists, no manual wiring — just drop a file and it's live.

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
├── server.js          ← start your app here
├── package.json
└── routes/
    ├── users.js       ← auto-loaded
    ├── posts.js       ← auto-loaded
    └── auth.js        ← auto-loaded
```

---

## Writing a Route File

Each file exports a function that receives the `app` instance:

::: code-group

```js [JavaScript (CommonJS)]
// routes/users.js
module.exports = function (app) {
  app.get('/users', (req, res) => {
    res.json({ users: [] });
  });

  app.post('/users', (req, res) => {
    res.status(201).json(req.body);
  });

  app.get('/users/:id', (req, res) => {
    res.json({ id: req.params.id });
  });
};
```

```js [JavaScript (ESM)]
// routes/users.js  (requires "type": "module" in package.json)
export default function (app) {
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

```ts [TypeScript]
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

:::

---

## Server Setup

Your `server.js` stays minimal — no route imports needed:

::: code-group

```js [JavaScript (CommonJS)]
// server.js
const { default: mimi, json, cors } = require('mimi.js');

const app = mimi(); // routes/ is loaded here automatically

app.use(json());
app.use(cors());

app.listen(3000, () => {
  console.log('Server on http://localhost:3000');
});
```

```js [JavaScript (ESM)]
// server.js
import mimi, { json, cors } from 'mimi.js';

const app = mimi(); // routes/ is loaded here automatically

app.use(json());
app.use(cors());

app.listen(3000, () => {
  console.log('Server on http://localhost:3000');
});
```

```ts [TypeScript]
// src/server.ts
import mimi, { json, cors } from 'mimi.js';

const app = mimi(); // routes/ is loaded here automatically

app.use(json());
app.use(cors());

app.listen(3000, () => {
  console.log('Server on http://localhost:3000');
});
```

:::

---

## CommonJS vs ES Modules Detection

The loader reads your `package.json` to decide how to load files:

| `package.json` | File format | Export style |
|---|---|---|
| No `"type"` or `"type": "commonjs"` | `.js` files loaded with `require()` | `module.exports = function(app) {}` |
| `"type": "module"` | `.js` files loaded with `import()` | `export default function(app) {}` |
| TypeScript | `.ts` files loaded with `require()` | `export default function(app) {}` |

---

## Benefits

**No boilerplate** — adding a route file is one step, not three (create, import, mount).

**Natural code splitting** — each domain (users, posts, auth) lives in its own file from day one.

**Scales without friction** — a 2-route app and a 200-route app have identical server setup files.

**Works with routers** — route files can mount a `Router` for sub-path grouping:

```js
// routes/api.js
const { Router } = require('mimi.js');

module.exports = function (app) {
  const router = new Router();

  router.get('/status', (req, res) => res.json({ ok: true }));
  router.get('/version', (req, res) => res.json({ version: '1.0.0' }));

  app.use('/api', router);
};
```

---

## When to Use `app.use()` Instead

The route loader is ideal for most projects. You may prefer manual `app.use()` when:

- You need strict ordering guarantees across route files
- You're building a library or framework on top of mimi.js
- Your project has a non-standard folder structure

In those cases, simply don't create a `routes/` folder — the loader skips silently.
