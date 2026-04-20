---
title: Routing
outline: deep
---

# Routing

Routes map HTTP methods + URL patterns to handler functions. mimi.js supports all standard HTTP methods, named parameters, optional segments, wildcards, and chained route definitions.

---

## Basic Routes

Register routes with `app.get()`, `app.post()`, `app.put()`, `app.patch()`, `app.delete()`:

```js
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

Every method handler returns the app, so you can chain:

```js
app
  .get('/ping', (req, res) => res.json({ ok: true }))
  .get('/version', (req, res) => res.json({ version: '2.0.0' }));
```

---

## Route Parameters

Named segments prefixed with `:` are captured in `req.params` as strings:

```js
// GET /users/42/posts/7
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
  // → { "userId": "42", "postId": "7" }
});
```

**Optional parameters** — append `?`:

```js
// Matches both /items  and  /items/123
app.get('/items/:id?', (req, res) => {
  res.json({ id: req.params.id ?? null });
});
```

**Wildcard segments** — use `*`:

```js
// Matches /files/any/depth/path.txt
app.get('/files/*', (req, res) => {
  res.json({ path: req.params[0] });
});
```

---

## Query Strings

`req.query` is a plain object — all values are strings:

```js
// GET /search?q=node&page=2&limit=20
app.get('/search', (req, res) => {
  const { q = '', page = '1', limit = '10' } = req.query;
  res.json({ query: q, page: Number(page), limit: Number(limit) });
});
```

---

## Request Body

Add `json()` middleware to parse JSON bodies into `req.body`:

::: code-group

```js [JavaScript]
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json());

app.post('/users', (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ name, email });
});
```

```ts [TypeScript]
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json());

app.post('/users', (req, res) => {
  const { name, email } = req.body as { name: string; email: string };
  res.status(201).json({ name, email });
});
```

:::

For URL-encoded form data, use `urlencoded()` instead (or in addition).

---

## `app.route()` — Chaining Multiple Methods

Use `app.route(path)` to define multiple HTTP methods on the same path without repeating the path string:

```js
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

::: code-group

```js [JavaScript]
const requireAuth = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const validateBody = (req, res, next) => {
  if (!req.body?.name) {
    return res.status(400).json({ error: 'name is required' });
  }
  next();
};

app.post('/items', requireAuth, validateBody, (req, res) => {
  res.status(201).json({ name: req.body.name });
});
```

```ts [TypeScript]
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

:::

---

## Async Handlers

mimi.js automatically forwards thrown errors from async handlers to `next(err)`:

```js
app.get('/users/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  res.json(user);
});
```

Or use `try/catch` with explicit `next`:

```js
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

## Route Grouping with a Sub-Router

Mount a `Router` at a prefix to group related routes. In large apps, each Router lives in its own file — see [Route Loader](/guide/route-loader) for zero-config file-based routing.

::: code-group

```js [JavaScript]
import mimi, { json, Router } from 'mimi.js';

const app = mimi();
app.use(json());

const users = new Router();
users.get('/', (req, res) => res.json({ users: [] }));
users.get('/:id', (req, res) => res.json({ id: req.params.id }));
users.post('/', (req, res) => res.status(201).json(req.body));

app.use('/api/users', users);
app.listen(3000);
```

```ts [TypeScript]
import mimi, { json, Router } from 'mimi.js';

const app = mimi();
app.use(json());

const users = new Router();
users.get('/', (req, res) => res.json({ users: [] }));
users.get('/:id', (req, res) => res.json({ id: req.params.id }));
users.post('/', (req, res) => res.status(201).json(req.body));

app.use('/api/users', users);
app.listen(3000);
```

:::

---

## `app.all()` — Any HTTP Method

Match any HTTP method — useful for logging or preflight:

```js
app.all('/api/*', (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## 404 — Route Not Found

mimi.js returns a `404 text/plain` when no route matches. Override it with a catch-all placed **after all routes**:

```js
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});
```

---

## Passing Data Between Handlers

Use `req.locals` to share data across handlers in the same request:

::: code-group

```js [JavaScript]
const loadUser = async (req, res, next) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  req.locals.user = user;
  next();
};

app.get('/users/:id', loadUser, (req, res) => {
  res.json(req.locals.user);
});
```

```ts [TypeScript]
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

:::
