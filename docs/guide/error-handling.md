---
title: Error Handling
outline: deep
---

# Error Handling

mimi.js gives you three layers of error handling, from the simplest case (pass errors to `next`) to full production control (`setErrorHandler`).

---

## How Errors Flow

When something goes wrong in a handler, call `next(err)`. mimi.js will skip all remaining normal middleware and route handlers, and forward the error to your error handler (or the built-in fallback).

```typescript
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.findUser(req.params.id);
    if (!user) return next(new Error('User not found'));
    res.json(user);
  } catch (err) {
    next(err); // passes any unexpected error downstream
  }
});
```

**Async handlers** — mimi.js automatically wraps async route handlers and passes thrown errors to `next`, so you can also just `throw`:

```typescript
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // throws → auto next(err)
  res.json(user);
});
```

---

## Default Error Behavior

Without a custom error handler:

- **5xx errors** → `{ "error": "Internal Server Error" }` — the original message is suppressed to avoid leaking internals
- **4xx errors** (via `error.status`) → `{ "error": "<original message>" }` — safe to expose to clients
- HTTP status set from `error.status` or `error.statusCode`, falling back to `500`

```typescript
// Produces: 404 { "error": "User not found" }
const err = Object.assign(new Error('User not found'), { status: 404 });
next(err);

// Produces: 500 { "error": "Internal Server Error" }  — message suppressed
next(new Error('DB connection string: postgres://user:pass@...'));
```

---

## Custom Error Classes

Create typed errors with an HTTP status code:

```typescript
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
  }
}

export class UnauthorizedError extends HttpError {
  constructor() {
    super(401, 'Unauthorized');
  }
}
```

Use them in your handlers:

```typescript
import { NotFoundError, UnauthorizedError } from './errors';

app.get('/posts/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new NotFoundError('Post');
  if (post.private && !req.user) throw new UnauthorizedError();
  res.json(post);
});
```

---

## `app.setErrorHandler(fn)`

Register a global error handler that intercepts **all** `next(err)` calls. This is the recommended approach for production APIs — it lets you normalize error shapes, add correlation IDs, and control what's exposed to clients.

```typescript
import mimi, { json } from 'mimi.js';
import type { AppErrorHandler } from 'mimi.js';

const app = mimi();
app.use(json());

// Register BEFORE calling app.listen()
app.setErrorHandler((err, req, res) => {
  const status = (err as any).status ?? 500;

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: err.message,
    path: req.url,
    timestamp: new Date().toISOString(),
  }));
});

app.get('/boom', (req, res, next) => {
  next(Object.assign(new Error('Something broke'), { status: 400 }));
});

app.listen(3000);
```

**`AppErrorHandler` signature:**

```typescript
type AppErrorHandler = (
  err: Error,
  req: MimiRequest,
  res: MimiResponse,
) => void | Promise<void>;
```

::: tip
`setErrorHandler` receives `(err, req, res)` — no `next`. It is responsible for sending the response. If it throws or is async and rejects, the default error handler takes over.
:::

::: warning
Register `setErrorHandler` before calling `app.listen()`. Handlers registered after the server starts will still work, but there's a small window at startup where the default handler applies.
:::

---

## Practical Example: API Error Normalizer

A production-ready error handler that:

- Distinguishes client errors (4xx) from server errors (5xx)
- Hides sensitive details in production
- Includes a request ID for log correlation

```typescript
import mimi, { json, requestLogger, logger } from 'mimi.js';

const app = mimi();
app.use(json());
app.use(requestLogger);

// Attach a request ID to every request
app.use((req, res, next) => {
  req.locals.requestId = crypto.randomUUID();
  next();
});

app.setErrorHandler((err, req, res) => {
  const status = (err as any).status ?? (err as any).statusCode ?? 500;
  const isClientError = status >= 400 && status < 500;
  const requestId = req.locals.requestId as string;

  // Always log the real error internally
  logger.error({ err, requestId, url: req.url, method: req.method });

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: isClientError
      ? err.message
      : 'An unexpected error occurred. Please try again.',
    requestId,
    status,
  }));
});

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (isNaN(Number(id))) {
    throw Object.assign(new Error('id must be a number'), { status: 400 });
  }
  const user = await db.find(id);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  res.json(user);
});

app.listen(3000);
```

---

## Error Middleware (4-arg form)

For scoped error handling within a specific route group, use a 4-argument middleware function. It must be placed **after** the routes it covers:

```typescript
const router = new Router();

router.get('/items', (req, res) => {
  throw new Error('list failed');
});

// Catches errors from the routes above it in this router
router.use((err: Error, req, res, next) => {
  if ((err as any).status === 404) {
    res.status(404).json({ error: 'Item not found' });
  } else {
    next(err); // pass other errors up
  }
});

app.use('/api/v1', router);
```

::: tip
A function is recognized as an error middleware by having **exactly 4 parameters**. TypeScript's `ErrorHandler` type (`(err, req, res, next) => void`) matches this signature.
:::

---

## 404 — Route Not Found

If no route matches, mimi.js sends a `404 text/plain` response. Override it with a catch-all handler at the end of your route definitions:

```typescript
// Place LAST — after all other routes
app.use((req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.url}`,
  });
});
```
