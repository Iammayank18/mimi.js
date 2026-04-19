---
title: Routing
outline: deep
---

# Routing

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

