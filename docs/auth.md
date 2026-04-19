---
title: Authentication
parent: Guide
nav_order: 4
---

# Authentication
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

mimi.js ships JWT and bcrypt authentication utilities. No extra packages needed for basic auth flows.

> **Peer dependency:** `bcrypt` must be installed for `hashPassword` and `comparePassword`.
> ```bash
> npm install bcrypt
> ```

---

## Password Hashing

### `hashPassword(password, saltRounds?)`

Hashes a plain-text password using bcrypt. Returns a `Promise<string>`.

```typescript
import { hashPassword } from 'mimi.js';

const hash = await hashPassword('my-secret-password');
// "$2b$10$..."
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `password` | `string` | required | Plain-text password |
| `saltRounds` | `number` | `10` | bcrypt cost factor (higher = slower + safer) |

### `comparePassword(password, hash)`

Compares a plain-text password to a bcrypt hash. Returns `Promise<boolean>`.

```typescript
import { comparePassword } from 'mimi.js';

const match = await comparePassword('my-secret-password', storedHash);
// true or false
```

---

## JWT Tokens

### Setup

Set the `JWT_SECRET` environment variable. This secret is used for both signing and verification.

```bash
# .env
JWT_SECRET=a-very-long-random-secret-string
```

### `generateToken(payload, expiresIn?)`

Signs a JWT and returns the token string.

```typescript
import { generateToken } from 'mimi.js';

const token = generateToken({ id: 42, email: 'user@example.com' });
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Custom expiry
const token7d = generateToken({ id: 42 }, '7d');
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `payload` | `object` | required | Data to encode in the token |
| `expiresIn` | `string` | `'1h'` | Token lifetime (`'15m'`, `'1h'`, `'7d'`, etc.) |

### `verifyToken(token)`

Verifies a JWT and returns the decoded payload. Throws if the token is invalid or expired.

```typescript
import { verifyToken } from 'mimi.js';

try {
  const payload = verifyToken(token);
  console.log(payload.email);
} catch (err) {
  // Invalid or expired token
}
```

---

## `authMiddleware`

Protects routes by requiring a valid `Authorization: Bearer <token>` header. Attaches the decoded token payload to `req.locals.user`.

```typescript
import mimi, { json, authMiddleware } from 'mimi.js';

const app = mimi();
app.use(json());

app.get('/profile', authMiddleware, (req, res) => {
  res.json({ user: req.locals.user });
});

app.listen(3000);
```

If the token is missing, invalid, or expired, the middleware responds with:

```json
{ "error": "Unauthorized" }
```

and HTTP status `401`.

---

## Complete Auth Flow Example

```typescript
import mimi, { json, hashPassword, comparePassword, generateToken, authMiddleware } from 'mimi.js';

const app = mimi();
app.use(json());

// In-memory user store (replace with your database)
const users: Array<{ id: number; email: string; password: string }> = [];

// POST /register
app.post('/register', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashed = await hashPassword(password);
  const user = { id: Date.now(), email, password: hashed };
  users.push(user);

  res.status(201).json({ id: user.id, email: user.email });
});

// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = users.find((u) => u.email === email);
  if (!user || !(await comparePassword(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken({ id: user.id, email: user.email });
  res.json({ token });
});

// GET /me — requires valid token
app.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.locals.user });
});

app.listen(3000, () => {
  console.log('Auth API running on http://localhost:3000');
});
```

---

## Customizing Auth

To build your own auth flow without `authMiddleware`, use `verifyToken` directly inside a middleware:

```typescript
import { verifyToken } from 'mimi.js';
import type { RequestHandler } from 'mimi.js';

const authenticate: RequestHandler = (req, res, next) => {
  const header = req.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    req.locals.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Role-based guard on top
const requireRole = (role: string): RequestHandler => (req, res, next) => {
  const user = req.locals.user as { role?: string } | undefined;
  if (user?.role !== role) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.delete('/admin/users/:id', authenticate, requireRole('admin'), (req, res) => {
  res.sendStatus(204);
});
```
