---
title: Error Handling
outline: deep
---

# Error Handling

mimi.js gives you three layers of error handling, from the simplest case (pass errors to `next`) to full production control (`setErrorHandler`).

---

## How Errors Flow

When something goes wrong in a handler, call `next(err)`. mimi.js will skip all remaining normal handlers and forward the error to your error handler (or the built-in fallback).

```js
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

**Async handlers** — mimi.js automatically catches thrown errors from async handlers and passes them to `next`, so you can just `throw`:

```js
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // throws → auto next(err)
  res.json(user);
});
```

---

## Default Error Behavior

Without a custom error handler:

- **5xx errors** → `{ "error": "Internal Server Error" }` — message suppressed to prevent leaking internals
- **4xx errors** (via `error.status`) → `{ "error": "<original message>" }` — safe to expose to clients
- HTTP status set from `error.status` or `error.statusCode`, falling back to `500`

```js
// Produces: 404 { "error": "User not found" }
const err = Object.assign(new Error('User not found'), { status: 404 });
next(err);

// Produces: 500 { "error": "Internal Server Error" }  — message suppressed
next(new Error('DB connection string: postgres://user:pass@...'));
```

---

## Custom Error Classes

::: code-group

```js [JavaScript]
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

class NotFoundError extends HttpError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
  }
}

// In a handler:
app.get('/posts/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new NotFoundError('Post');
  res.json(post);
});
```

```ts [TypeScript]
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

// In a handler:
app.get('/posts/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw new NotFoundError('Post');
  res.json(post);
});
```

:::

---

## `app.setErrorHandler(fn)`

Register a global error handler that intercepts **all** `next(err)` calls. This is the recommended approach for production APIs.

::: code-group

```js [JavaScript]
import mimi, { json } from 'mimi.js';

const app = mimi();
app.use(json());

app.setErrorHandler((err, req, res) => {
  const status = err.status ?? 500;

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

```ts [TypeScript]
import mimi, { json } from 'mimi.js';
import type { AppErrorHandler } from 'mimi.js';

const app = mimi();
app.use(json());

const handler: AppErrorHandler = (err, req, res) => {
  const status = (err as any).status ?? 500;

  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    error: err.message,
    path: req.url,
    timestamp: new Date().toISOString(),
  }));
};

app.setErrorHandler(handler);

app.get('/boom', (req, res, next) => {
  next(Object.assign(new Error('Something broke'), { status: 400 }));
});

app.listen(3000);
```

:::

::: tip
`setErrorHandler` receives `(err, req, res)` — no `next`. It is responsible for sending the response. Register it before `app.listen()`.
:::

---

## Practical Example: API Error Normalizer

A production-ready error handler that hides internal details from clients and logs everything:

::: code-group

```js [JavaScript]
import mimi, { json, requestLogger, logger } from 'mimi.js';

const app = mimi();
app.use(json());
app.use(requestLogger);

app.use((req, res, next) => {
  req.locals.requestId = crypto.randomUUID();
  next();
});

app.setErrorHandler((err, req, res) => {
  const status = err.status ?? err.statusCode ?? 500;
  const isClientError = status >= 400 && status < 500;
  const requestId = req.locals.requestId;

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

```ts [TypeScript]
import mimi, { json, requestLogger, logger } from 'mimi.js';
import type { AppErrorHandler } from 'mimi.js';

const app = mimi();
app.use(json());
app.use(requestLogger);

app.use((req, res, next) => {
  req.locals.requestId = crypto.randomUUID();
  next();
});

const errorHandler: AppErrorHandler = (err, req, res) => {
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
};

app.setErrorHandler(errorHandler);
app.listen(3000);
```

:::

---

## Error Middleware (4-arg form)

For scoped error handling within a route group, use a 4-argument middleware function placed **after** the routes it covers:

```js
const router = new Router();

router.get('/items', (req, res) => {
  throw new Error('list failed');
});

// Catches errors from the routes above it
router.use((err, req, res, next) => {
  if (err.status === 404) {
    res.status(404).json({ error: 'Item not found' });
  } else {
    next(err); // pass other errors up
  }
});

app.use('/api/v1', router);
```

::: tip
A function is recognized as error middleware by having **exactly 4 parameters**. For TypeScript, import the `ErrorHandler` type from `'mimi.js'`.
:::

---

## 404 — Route Not Found

mimi.js sends a `404 text/plain` response when no route matches. Override with a catch-all placed **after all routes**:

```js
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});
```
