---
title: Error Handling
outline: deep
---

# Error Handling

mimi.js gives you three layers of error handling, from the simplest case (pass errors to `next`) to full production control (`setErrorHandler`).

---

## How Errors Flow

When something goes wrong in a handler, call `next(err)`. mimi.js skips all remaining normal handlers and forwards the error to your error handler (or the built-in fallback).

```ts
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.findUser(req.params.id);
    if (!user) return next(new Error('User not found'));
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

**Async handlers** — mimi.js automatically catches thrown errors and passes them to `next`, so you can just `throw`:

```ts
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // throws → auto next(err)
  res.json(user);
});
```

---

## Default Error Behavior

Without a custom error handler:

- **5xx errors** → `{ "error": "Internal Server Error" }` — message suppressed to prevent leaking internals
- **4xx errors** (via `error.status`) → `{ "error": "<original message>" }` — safe to expose
- HTTP status set from `error.status` or `error.statusCode`, falling back to `500`

```ts
// Produces: 404 { "error": "User not found" }
next(Object.assign(new Error('User not found'), { status: 404 }));

// Produces: 500 { "error": "Internal Server Error" }  — message suppressed
next(new Error('DB connection string: postgres://user:pass@...'));
```

---

## Custom Error Classes

```ts
class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

class NotFoundError extends HttpError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
  }
}
```

Use them in handlers:

```ts
app.get('/posts/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new NotFoundError('Post');
  res.json(post);
});
```

---

## `app.setErrorHandler(fn)`

Register a global error handler that intercepts **all** `next(err)` calls.

```ts
import mimi, { json } from 'mimi.js';
import type { AppErrorHandler } from 'mimi.js';

const app = mimi();
app.use(json());

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

app.listen(3000);
```

**Signature:**

```ts
type AppErrorHandler = (err: Error, req: MimiRequest, res: MimiResponse) => void | Promise<void>;
```

::: tip
`setErrorHandler` receives `(err, req, res)` — no `next`. It is responsible for sending the response. Register it before `app.listen()`.
:::

---

## Practical Example: API Error Normalizer

```ts
import mimi, { json, requestLogger, logger } from 'mimi.js';

const app = mimi();
app.use(json());
app.use(requestLogger);

app.use((req, res, next) => {
  req.locals.requestId = crypto.randomUUID();
  next();
});

app.setErrorHandler((err, req, res) => {
  const status = (err as any).status ?? (err as any).statusCode ?? 500;
  const isClientError = status >= 400 && status < 500;
  const requestId = req.locals.requestId as string;

  logger.error({ err, requestId, url: req.url, method: req.method });

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: isClientError ? err.message : 'An unexpected error occurred.',
    requestId,
    status,
  }));
});

app.listen(3000);
```

---

## Error Middleware (4-arg form)

For scoped error handling within a route group, use a 4-argument middleware placed **after** the routes it covers:

```ts
import type { ErrorHandler } from 'mimi.js';

const router = new Router();

router.get('/items', (req, res) => {
  throw new Error('list failed');
});

router.use(((err, req, res, next) => {
  if ((err as any).status === 404) {
    res.status(404).json({ error: 'Item not found' });
  } else {
    next(err);
  }
}) as ErrorHandler);

app.use('/api/v1', router);
```

---

## 404 — Route Not Found

mimi.js sends `404 text/plain` when no route matches. Override with a catch-all placed **after all routes**:

```ts
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});
```
