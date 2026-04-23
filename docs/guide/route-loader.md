---
title: Route Loader
outline: deep
---

# Route Loader

The route loader automatically discovers and mounts every file inside your `routes/` folder. No import lists, no manual wiring — just drop a file and it's live.

---

## How It Works

When your app starts, mimi.js:

1. Looks for a `routes/` folder in your project root
2. Reads every `.js` and `.ts` file inside it
3. Mounts each file's default export — either a `Router` instance or a factory function
4. Your routes are registered — automatically

If the `routes/` folder doesn't exist, the loader silently skips and your app starts normally.

---

## File Structure

```
my-app/
├── index.ts
├── package.json
└── routes/
    ├── auth.ts        ← auto-loaded
    ├── users.ts       ← auto-loaded
    └── products.ts    ← auto-loaded
```

---

## Writing a Route File

### Recommended — `export default router`

Create a `Router`, define your routes, export it as default. This is the same pattern as Express Router.

```ts
// routes/users.ts
import { Router, authMiddleware } from 'mimi.js';

const router = new Router();

router.get('/users', (_req, res) => {
  res.json({ users: [] });
});

router.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

router.post('/users', (req, res) => {
  res.status(201).json(req.body);
});

router.delete('/users/:id', authMiddleware, (_req, res) => {
  res.sendStatus(204);
});

export default router;
```

### Alternative — factory function

Export a function that receives the `app` instance. Useful when you need direct access to `app`.

```ts
// routes/health.ts
import type { MimiApp } from 'mimi.js';

export default function (app: MimiApp) {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
}
```

Both patterns are auto-detected by the loader — use whichever fits the file.

---

## Server Setup

Your `index.ts` stays minimal — no route imports needed:

```ts
import mimi, { json, cors, security, requestLogger } from 'mimi.js';

const app = mimi(); // routes/ loaded automatically on startup

app.use(requestLogger);
app.use(json());
app.use(cors({ origin: '*' }));
app.use(security());

app.listen(3000, () => {
  console.log('Server on http://localhost:3000');
});
```

---

## Full Example

```
my-app/
├── index.ts
├── .env              (PORT, JWT_SECRET)
└── routes/
    ├── auth.ts
    ├── users.ts
    └── products.ts
```

```ts
// routes/auth.ts
import { Router, hashPassword, comparePassword, generateToken, authMiddleware } from 'mimi.js';

const router = new Router();

router.post('/auth/register', async (req: any, res: any) => {
  const { name, email, password } = req.body;
  const hash = await hashPassword(password);
  // save user to DB...
  res.status(201).json({ message: 'Registered', email });
});

router.post('/auth/login', async (req: any, res: any) => {
  const { email, password } = req.body;
  // fetch user from DB...
  const token = generateToken({ id: user.id, email });
  res.json({ token });
});

router.get('/auth/me', authMiddleware, (req: any, res: any) => {
  res.json({ user: req.user });
});

export default router;
```

```ts
// routes/products.ts
import { Router, authMiddleware } from 'mimi.js';

const router = new Router();

router.get('/products', (req: any, res: any) => {
  const { search, category } = req.query;
  // filter products...
  res.json({ products: [] });
});

router.get('/products/:id', (req: any, res: any) => {
  res.json({ id: req.params.id });
});

router.post('/products', authMiddleware, (req: any, res: any) => {
  res.status(201).json(req.body);
});

export default router;
```

---

## Route File Rules

- Files must be in the top-level `routes/` directory
- Only `.js` and `.ts` extensions are loaded
- Default export must be a `Router` instance or a function — anything else is skipped
- Route paths are **full paths** (e.g. `/users`, `/users/:id`) — the loader mounts with no prefix

---

## Benefits

**No boilerplate** — adding a route file is one step, not three (create, import, mount).

**Natural code splitting** — each domain (users, products, auth) lives in its own file.

**Scales without friction** — a 2-route app and a 200-route app have identical `index.ts` files.

---

## When to Use Manual Mounting Instead

The route loader works for most projects. You may prefer `app.use()` when:

- You need strict loading order across route files
- You want to mount a router at a URL prefix (`app.use('/api/v1', router)`)
- Your project uses a non-standard folder structure

In those cases, skip the `routes/` folder and wire routes manually — the loader skips silently.
