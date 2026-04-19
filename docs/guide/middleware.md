---
title: Middleware
outline: deep
---

# Middleware

## Writing Custom Middleware

Any function with the signature `(req, res, next)` is valid middleware:

```typescript
import type { RequestHandler } from 'mimi.js';

const timing: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} — ${Date.now() - start}ms`);
  });
  next();
};

app.use(timing);
```

### Attaching Data to `req.locals`

Use `req.locals` to pass data between middleware without augmenting `req` types:

```typescript
const attachUser: RequestHandler = async (req, res, next) => {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  if (token) {
    req.locals.user = await getUserFromToken(token);
  }
  next();
};

app.use(attachUser);

app.get('/me', (req, res) => {
  res.json({ user: req.locals.user ?? null });
});
```

### Error Middleware

Define a 4-argument handler to catch errors. Must be placed **after** all routes:

```typescript
import type { ErrorHandler } from 'mimi.js';

const errorHandler: ErrorHandler = (err, req, res, next) => {
  const status = (err as any).status ?? 500;
  res.status(status).json({
    error: err.message,
    path: req.url,
  });
};

app.use(errorHandler);
```

### Scoped Middleware

Apply middleware to specific routes by passing it as a handler argument:

```typescript
function adminOnly(req: any, res: any, next: any) {
  if (req.locals.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

app.get('/admin/stats', adminOnly, (req, res) => {
  res.json({ users: 1000 });
});
```
