---
title: Routing
parent: Guide
nav_order: 2
---

# Routing
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Basic Routes

```typescript
import mimi from 'mimi.js';

const app = mimi();

app.get('/users', (req, res) => res.json([]));
app.post('/users', (req, res) => res.status(201).json(req.body));
app.put('/users/:id', (req, res) => res.json({ id: req.params.id }));
app.patch('/users/:id', (req, res) => res.json({ updated: true }));
app.delete('/users/:id', (req, res) => res.sendStatus(204));
```

All HTTP methods are supported: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`.  
Use `app.all(path, handler)` to match any HTTP method.

---

## Route Parameters

Named segments prefixed with `:` become `req.params`:

```typescript
// GET /users/42/posts/7
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
  // → { "userId": "42", "postId": "7" }
});
```

Optional parameters use `?`:

```typescript
// Matches /items and /items/123
app.get('/items/:id?', (req, res) => {
  res.json({ id: req.params.id ?? null });
});
```

Wildcard segments use `*`:

```typescript
// Matches /files/a/b/c
app.get('/files/*', (req, res) => {
  res.json({ path: req.params[0] });
});
```

---

## Query Strings

Query parameters are available on `req.query` as a plain object of strings:

```typescript
// GET /search?q=hello&page=2&limit=20
app.get('/search', (req, res) => {
  const { q, page, limit } = req.query;
  res.json({
    query: q,
    page: parseInt(page ?? '1', 10),
    limit: parseInt(limit ?? '10', 10),
  });
});
```

---

## Chaining Methods on a Path

```typescript
app.route('/articles')
  .get((req, res) => res.json([]))
  .post((req, res) => res.status(201).json(req.body));

app.route('/articles/:id')
  .get((req, res) => res.json({ id: req.params.id }))
  .put((req, res) => res.json({ updated: true }))
  .delete((req, res) => res.sendStatus(204));
```

---

## Router (Sub-routers)

Group related routes into a `Router` and mount them at a prefix:

```typescript
import mimi, { Router } from 'mimi.js';

const app = mimi();

// Users router
const users = Router();
users.get('/', (_req, res) => res.json({ users: [] }));
users.post('/', (req, res) => res.status(201).json(req.body));
users.get('/:id', (req, res) => res.json({ id: req.params.id }));

// Products router
const products = Router();
products.get('/', (_req, res) => res.json({ products: [] }));

// Mount at prefix
app.use('/users', users);
app.use('/products', products);

app.listen(3000);
```

Requests to `/users/*` are handled by the users router, `/products/*` by the products router.

---

## Multiple Handlers (Handler Chaining)

Pass multiple handlers to any route. Each calls `next()` to pass control:

```typescript
function requireAuth(req: any, res: any, next: any) {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function validate(req: any, res: any, next: any) {
  if (!req.body?.name) {
    return res.status(400).json({ error: 'name is required' });
  }
  next();
}

app.post('/items', requireAuth, validate, (req, res) => {
  res.status(201).json({ name: (req.body as any).name });
});
```

---

## Async Handlers

Async route handlers are fully supported. Thrown errors are automatically forwarded to the error handler:

```typescript
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});
```

No need for `try/catch` around your database call — uncaught errors pass to the next error handler in the chain.

---

## Error Handling

Define a 4-argument handler to catch errors:

```typescript
import type { ErrorHandler } from 'mimi.js';

const errorHandler: ErrorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
};

// Register after all routes
app.use(errorHandler);
```

Errors passed via `next(err)` or thrown in async handlers are caught and forwarded:

```typescript
app.get('/fail', (_req, _res, next) => {
  next(new Error('Something went wrong'));
});
```

---

## 404 Handling

Add a catch-all route at the end to handle unmatched paths:

```typescript
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
```
