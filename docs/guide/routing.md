---
title: Routing
outline: deep
---

# Routing

Routes map HTTP methods + URL patterns to handler functions. mimi.js supports all standard HTTP methods, named parameters, optional segments, wildcards, and chained route definitions.

---

## Basic Routes

```ts
app.get('/hello', (req, res) => {
  res.json({ message: 'Hello!' });
});

app.post('/users', (req, res) => {
  res.status(201).json({ created: req.body });
});

app.put('/users/:id', (req, res) => {
  res.json({ updated: req.params.id });
});

app.delete('/users/:id', (req, res) => {
  res.sendStatus(204);
});
```

Every method returns the app, so you can chain:

```ts
app
  .get('/ping', (req, res) => res.json({ ok: true }))
  .get('/version', (req, res) => res.json({ version: '2.0.0' }));
```

---

## Route Parameters

Named segments prefixed with `:` are captured in `req.params` as strings:

```ts
// GET /users/42/posts/7
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
  // → { "userId": "42", "postId": "7" }
});
```

**Optional parameters** — append `?`:

```ts
// Matches /items  and  /items/123
app.get('/items/:id?', (req, res) => {
  res.json({ id: req.params.id ?? null });
});
```

**Wildcard segments** — use `*`:

```ts
// Matches /files/any/depth/path.txt
app.get('/files/*', (req, res) => {
  res.json({ path: req.params[0] });
});
```

---

## Query Strings

`req.query` is a plain object — all values are strings:

```ts
// GET /search?q=node&page=2&limit=20
app.get('/search', (req, res) => {
  const { q = '', page = '1', limit = '10' } = req.query;
  res.json({ query: q, page: Number(page), limit: Number(limit) });
});
```

---

## Request Body

Add `json()` middleware to parse JSON bodies into `req.body`:

```ts
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json());

app.post('/users', (req, res) => {
  const { name, email } = req.body as { name: string; email: string };
  res.status(201).json({ name, email });
});
```

For URL-encoded form data, use `urlencoded()` instead (or in addition).

---

## `app.route()` — Chaining Multiple Methods

Define multiple HTTP methods on the same path without repeating it:

```ts
app.route('/articles')
  .get((req, res) => res.json({ articles: [] }))
  .post((req, res) => res.status(201).json(req.body));

app.route('/articles/:id')
  .get((req, res) => res.json({ id: req.params.id }))
  .put((req, res) => res.json({ updated: true }))
  .delete((req, res) => res.sendStatus(204));
```

---

## Handler Pipelines

Pass multiple handlers to a route. Each calls `next()` to pass control forward:

```ts
import type { RequestHandler } from 'mimi.js';

const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const validateBody: RequestHandler = (req, res, next) => {
  if (!(req.body as any)?.name) {
    return res.status(400).json({ error: 'name is required' });
  }
  next();
};

app.post('/items', requireAuth, validateBody, (req, res) => {
  res.status(201).json({ name: (req.body as any).name });
});
```

---

## Async Handlers

mimi.js automatically catches thrown errors from async handlers:

```ts
app.get('/users/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  res.json(user);
});
```

Or use `try/catch` with explicit `next`:

```ts
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.users.findById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

---

## Route Grouping with `Router`

`Router` lets you organise related routes into a standalone module and mount them at a path prefix — the same pattern as Express.

### Inline usage

```ts
import mimi, { json, Router } from 'mimi.js';

const app = mimi();
app.use(json());

const users = new Router();
users.get('/', (_req, res) => res.json({ users: [] }));
users.get('/:id', (req, res) => res.json({ id: req.params.id }));
users.post('/', (req, res) => res.status(201).json(req.body));
users.delete('/:id', (_req, res) => res.sendStatus(204));

app.use('/users', users); // mount at /users prefix

app.listen(3000);
// GET /users      → users.get('/')
// GET /users/42   → users.get('/:id')
```

### File-based usage (recommended)

Drop a file in your `routes/` directory and export a `Router` as `default`. The auto-loader picks it up automatically — no manual mounting needed.

```ts
// routes/products.ts
import { Router } from 'mimi.js';

const router = new Router();

router.get('/products', (_req, res) => res.json({ products: [] }));
router.get('/products/:id', (req, res) => res.json({ id: req.params.id }));
router.post('/products', (req, res) => res.status(201).json(req.body));

export default router;
```

```ts
// index.ts — nothing extra needed; mimi() auto-loads routes/*
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json());
app.listen(3000);
```

> When using the auto-loader, register the **full path** on each handler (`/products`, `/products/:id`) — the loader mounts with no prefix.
> When using `app.use('/prefix', router)`, register **relative paths** (`/`, `/:id`) — the prefix is prepended automatically.

See [Route Loader](/guide/route-loader) for the full auto-loading convention.

---

## `app.all()` — Any HTTP Method

```ts
app.all('/api/*', (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## 404 — Route Not Found

When no route matches, mimi.js automatically returns a plain-text `404` response. No extra code needed.

::: warning Do not use `app.use()` for 404 handling
`app.use()` handlers run as **middleware** — before route handlers are looked up in the trie. A catch-all `app.use((req, res) => { ... })` fires on *every* request, preventing routes from ever matching.
:::

To customise the 404 body, intercept it in `setErrorHandler` by checking the status code, or handle it in the framework's final handler by not registering anything extra.

---

## Passing Data Between Handlers

Use `req.locals` to share data across handlers in the same request:

```ts
import type { RequestHandler } from 'mimi.js';

const loadUser: RequestHandler = async (req, res, next) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  req.locals.user = user;
  next();
};

app.get('/users/:id', loadUser, (req, res) => {
  res.json(req.locals.user);
});
```
