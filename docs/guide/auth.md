---
title: Authentication
outline: deep
---

# Authentication

mimi.js ships JWT and bcrypt authentication utilities. No extra packages needed for basic auth flows.

> **Peer dependency:** `bcrypt` must be installed for `hashPassword` and `comparePassword`.
> ```bash
> npm install bcrypt
> ```

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

