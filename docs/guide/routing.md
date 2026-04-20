---
title: Routing
outline: deep
---

# Routing

Routes map HTTP methods + URL patterns to handler functions. mimi.js supports all standard HTTP methods, named parameters, optional segments, wildcards, and chained route definitions.

---

## Basic Routes

Register routes with `app.get()`, `app.post()`, `app.put()`, `app.patch()`, `app.delete()`:

```typescript
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

```typescript
app
  .get('/ping', (req, res) => res.json({ ok: true }))
  .get('/version', (req, res) => res.json({ version: '2.0.0' }));
```

---

## Route Parameters

Named segments prefixed with `:` are captured in `req.params` as strings:

```typescript
// GET /users/42/posts/7
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
  // → { "userId": "42", "postId": "7" }
});
```

**Optional parameters** — append `?`:

```typescript
// Matches both /items  and  /items/123
app.get('/items/:id?', (req, res) => {
  res.json({ id: req.params.id ?? null });
});
```

**Wildcard segments** — use `*`:

```typescript
// Matches /files/any/depth/path.txt
app.get('/files/*', (req, res) => {
  res.json({ path: req.params[0] });
});
```

---

## Query Strings

`req.query` is a `Record<string, string>` — all values are strings:

```typescript
// GET /search?q=node&page=2&limit=20
app.get('/search', (req, res) => {
  const { q = '', page = '1', limit = '10' } = req.query;
  res.json({
    query: q,
    page: Number(page),
    limit: Number(limit),
  });
});
```

---

## Request Body

Add the `json()` middleware to parse JSON bodies into `req.body`:

```typescript
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

Use `app.route(path)` to define multiple HTTP methods on the same path without repeating the path string:

```typescript
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

Pass multiple handlers to a route. Each handler calls `next()` to pass control to the next one:

```typescript
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

mimi.js wraps async route handlers and automatically forwards thrown errors to `next(err)`:

```typescript
app.get('/users/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  res.json(user);
});
```

You can also use `try/catch` with explicit `next`:

```typescript
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

Mount a `Router` at a prefix to group related routes:

```typescript
import mimi, { json } from 'mimi.js';
import { Router } from 'mimi.js';

const app = mimi();
app.use(json());

// users.router.ts
const users = new Router();
users.get('/', (req, res) => res.json({ users: [] }));
users.get('/:id', (req, res) => res.json({ id: req.params.id }));
users.post('/', (req, res) => res.status(201).json(req.body));

// posts.router.ts
const posts = new Router();
posts.get('/', (req, res) => res.json({ posts: [] }));
posts.post('/', (req, res) => res.status(201).json(req.body));

// Mount at prefixes
app.use('/api/v1/users', users);
app.use('/api/v1/posts', posts);

app.listen(3000);
```

All routes on `users` are now accessible at `/api/v1/users/*`.

---

## `app.all()` — Any HTTP Method

Match any HTTP method on a path — useful for catch-all logging or CORS preflight:

```typescript
app.all('/api/*', (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## 404 — Route Not Found

mimi.js sends a `404 text/plain` response when no route matches. Override it with a catch-all handler placed **after all other routes**:

```typescript
// Must be last
app.use((req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.url}`,
  });
});
```

---

## Passing Data Between Handlers

Use `req.locals` to share data across handlers in the same request:

```typescript
const loadUser: RequestHandler = async (req, res, next) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  req.locals.user = user;
  next();
};

app.get('/users/:id', loadUser, (req, res) => {
  res.json(req.locals.user);
});

app.put('/users/:id', loadUser, (req, res) => {
  const user = req.locals.user as User;
  res.json({ ...user, ...(req.body as object) });
});
```
