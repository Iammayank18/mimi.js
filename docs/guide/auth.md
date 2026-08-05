---
title: Authentication
outline: deep
---

# Authentication

mimi.js ships JWT and bcrypt authentication utilities.

## Prerequisites

Install the required peer dependencies before using any auth features:

```bash
npm install bcrypt dotenv
```

- **`bcrypt`** — needed for `hashPassword` and `comparePassword`
- **`dotenv`** — needed to load `JWT_SECRET` from a `.env` file

## JWT Tokens

### Setup

Create a `.env` file in your project root and set `JWT_SECRET`:

```bash
# .env
JWT_SECRET=a-very-long-random-secret-string
```

Then load it at the top of your entry file before anything else:

```typescript
import { configDotenv } from 'dotenv';
configDotenv();
```

`JWT_SECRET` is used for both signing and verification. mimi.js will throw at token generation time if it is not set.

### `generateToken(payload, expiresIn?)`

Signs a JWT and returns the token string.

```typescript
import { generateToken } from 'mimi.js';

const token = generateToken({ id: 42, email: 'user@example.com' });
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Custom expiry
const token7d = generateToken({ id: 42, email: 'user@example.com' }, '7d');
```

| Parameter   | Type     | Default  | Description                                    |
| ----------- | -------- | -------- | ---------------------------------------------- |
| `payload`   | `object` | required | Data to encode in the token                    |
| `expiresIn` | `string` | `'1h'`   | Token lifetime (`'15m'`, `'1h'`, `'7d'`, etc.) |

### `verifyToken(token)`

Verifies a JWT and returns the decoded payload. Returns `null` if the token is invalid, expired, or has been superseded by a newer `generateToken()` call for the same user.

```typescript
import { verifyToken } from 'mimi.js';

const payload = verifyToken(token);
if (!payload) {
  // invalid, expired, or revoked token
}
```

### `invalidateToken(userId)`

Explicitly revokes all tokens for a user — use in logout handlers. After this call, `verifyToken` will reject every previously-issued token for that user.

```typescript
import { invalidateToken } from 'mimi.js';

app.post('/logout', authMiddleware, async (req, res) => {
  await invalidateToken((req as any).user.id);
  res.json({ message: 'Logged out — all tokens for this user are now invalid' });
});
```

| Parameter | Type               | Description                                |
| --------- | ------------------ | ------------------------------------------ |
| `userId`  | `string \| number` | The user ID whose tokens should be revoked |

Note: Calling `generateToken()` again for the same user also invalidates all previous tokens automatically.

### `setTokenStore(store)` — Custom Token Store

By default, mimi.js uses an in-memory token version store (single-process only). For distributed deployments, swap it with a Redis or database-backed store:

```typescript
import { setTokenStore } from 'mimi.js';
import type { TokenStore } from 'mimi.js';

// Call this once at startup, before any tokens are issued
setTokenStore(myRedisStore);
```

#### `TokenStore` interface

```typescript
interface TokenStore {
  set(userId: string, version: string): void | Promise<void>;
  get(userId: string): string | null | Promise<string | null>;
  invalidate(userId: string): void | Promise<void>;
}
```

**Redis adapter example:**

```typescript
import { createClient } from 'redis';
import type { TokenStore } from 'mimi.js';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const redisTokenStore: TokenStore = {
  async set(userId, version) {
    await redis.set(`token:v:${userId}`, version);
  },
  async get(userId) {
    return redis.get(`token:v:${userId}`);
  },
  async invalidate(userId) {
    await redis.del(`token:v:${userId}`);
  },
};

setTokenStore(redisTokenStore);
```

## Complete Auth Flow Example

```typescript
import { configDotenv } from 'dotenv';
import mimi, {
  json,
  hashPassword,
  comparePassword,
  generateToken,
  invalidateToken,
  authMiddleware,
} from 'mimi.js';

configDotenv(); // loads JWT_SECRET from .env

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
  res.json({ user: (req as any).user });
});

// POST /logout — revokes all tokens for the authenticated user
app.post('/logout', authMiddleware, async (req, res) => {
  await invalidateToken((req as any).user.id);
  res.json({ message: 'Logged out successfully' });
});

app.listen(3000, () => {
  console.log('Auth API running on http://localhost:3000');
});
```
