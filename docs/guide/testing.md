---
title: Testing
outline: deep
---

# Testing

mimi.js apps are easy to test — `app.listen(0)` binds to a random available port, so you can run tests without port conflicts.

---

## Setup

Install vitest and Node's built-in HTTP client (no extra testing HTTP library needed):

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

`vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

Add test scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## A Reusable Test Helper

Create a small helper that starts your app on a random port and provides a typed `request()` function:

```typescript
// tests/helpers.ts
import http from 'http';
import mimi from 'mimi.js';
import type { MimiApp } from 'mimi.js';

export function buildApp(setup: (app: MimiApp) => void) {
  const app = mimi();
  setup(app);
  return app;
}

export async function startServer(app: MimiApp): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address() as { port: number };
      resolve({
        port,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
    server.on('error', reject);
  });
}

export async function request(
  port: number,
  opts: {
    method?: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; body: unknown; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload = opts.body ? JSON.stringify(opts.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: opts.method ?? 'GET',
        path: opts.path,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload).toString() } : {}),
          ...opts.headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let body: unknown = raw;
          try { body = JSON.parse(raw); } catch {}
          resolve({ status: res.statusCode ?? 0, body, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
```

---

## Testing a GET Route

```typescript
// tests/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { json } from 'mimi.js';
import { buildApp, startServer, request } from './helpers';

describe('GET /users', () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const app = buildApp((a) => {
      a.use(json());
      a.get('/users', (req, res) => {
        res.json([{ id: 1, name: 'Alice' }]);
      });
    });
    ({ port, close } = await startServer(app));
  });

  afterAll(() => close());

  it('returns 200 with a list of users', async () => {
    const { status, body } = await request(port, { path: '/users' });
    expect(status).toBe(200);
    expect(body).toEqual([{ id: 1, name: 'Alice' }]);
  });
});
```

---

## Testing a POST Route

```typescript
// tests/posts.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { json } from 'mimi.js';
import { buildApp, startServer, request } from './helpers';

describe('POST /posts', () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const app = buildApp((a) => {
      a.use(json());
      a.post('/posts', (req, res) => {
        const { title } = req.body as { title: string };
        if (!title) {
          return res.status(400).json({ error: 'title is required' });
        }
        res.status(201).json({ id: 42, title });
      });
    });
    ({ port, close } = await startServer(app));
  });

  afterAll(() => close());

  it('creates a post and returns 201', async () => {
    const { status, body } = await request(port, {
      method: 'POST',
      path: '/posts',
      body: { title: 'Hello World' },
    });
    expect(status).toBe(201);
    expect((body as any).title).toBe('Hello World');
  });

  it('returns 400 when title is missing', async () => {
    const { status, body } = await request(port, {
      method: 'POST',
      path: '/posts',
      body: {},
    });
    expect(status).toBe(400);
    expect((body as any).error).toBe('title is required');
  });
});
```

---

## Testing Authentication Middleware

```typescript
// tests/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authMiddleware, generateToken } from 'mimi.js';
import { buildApp, startServer, request } from './helpers';

describe('authMiddleware', () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';

    const app = buildApp((a) => {
      a.get('/protected', authMiddleware, (req, res) => {
        res.json({ user: (req as any).user });
      });
    });
    ({ port, close } = await startServer(app));
  });

  afterAll(() => close());

  it('returns 401 with no token', async () => {
    const { status } = await request(port, { path: '/protected' });
    expect(status).toBe(401);
  });

  it('returns 200 with a valid token', async () => {
    const token = generateToken({ id: '1', email: 'alice@example.com' });
    const { status, body } = await request(port, {
      path: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(status).toBe(200);
    expect((body as any).user.email).toBe('alice@example.com');
  });
});
```

---

## Testing Error Handling

```typescript
// tests/errors.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp, startServer, request } from './helpers';
import type { AppErrorHandler } from 'mimi.js';

describe('error handler', () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const app = buildApp((a) => {
      a.get('/boom', (req, res, next) => {
        next(Object.assign(new Error('Something broke'), { status: 422 }));
      });

      const handler: AppErrorHandler = (err, req, res) => {
        res.statusCode = (err as any).status ?? 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message, custom: true }));
      };
      a.setErrorHandler(handler);
    });
    ({ port, close } = await startServer(app));
  });

  afterAll(() => close());

  it('calls the custom error handler', async () => {
    const { status, body } = await request(port, { path: '/boom' });
    expect(status).toBe(422);
    expect((body as any).error).toBe('Something broke');
    expect((body as any).custom).toBe(true);
  });
});
```

---

## Testing with a Real Database (SQLite in memory)

Use `:memory:` to spin up a fresh SQLite database for each test file — no cleanup needed:

```typescript
// tests/db.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SQLiteManager, json } from 'mimi.js';
import { DataTypes } from 'sequelize';
import { buildApp, startServer, request } from './helpers';

describe('Post CRUD', () => {
  let port: number;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = new SQLiteManager(); // in-memory
    await db.connect();

    const Post = db.sequelize.define('Post', {
      title: { type: DataTypes.STRING, allowNull: false },
    });
    await Post.sync({ force: true }); // fresh table every test run

    const app = buildApp((a) => {
      a.use(json());
      a.get('/posts', async (req, res) => {
        res.json(await Post.findAll());
      });
      a.post('/posts', async (req, res) => {
        const post = await Post.create(req.body as any);
        res.status(201).json(post);
      });
    });

    ({ port, close } = await startServer(app));
  });

  afterAll(() => close());

  it('starts empty', async () => {
    const { body } = await request(port, { path: '/posts' });
    expect(body).toEqual([]);
  });

  it('creates and retrieves a post', async () => {
    await request(port, { method: 'POST', path: '/posts', body: { title: 'First' } });
    const { body } = await request(port, { path: '/posts' });
    expect((body as any[]).length).toBe(1);
    expect((body as any[])[0].title).toBe('First');
  });
});
```

---

## Coverage

Run tests with V8 coverage:

```bash
npm run test:coverage
```

Output shows line, branch, and function coverage. Aim for **80%** across your `src/` directory.
