---
title: Plugins
outline: deep
---

# Plugins

Plugins let you package and reuse groups of routes, middleware, and startup logic. They are the recommended way to organize production apps into modular units.

---

## Plugin vs Middleware

| | Middleware | Plugin |
|---|---|---|
| Registered with | `app.use()` | `app.register()` |
| Can be async | Yes (but `app.use()` doesn't await) | Yes — `register()` awaits async plugins |
| Typical use | Request processing (auth, logging, parsing) | App setup (DB connections, routes, sub-apps) |

---

## Your First Plugin

A plugin is any function with the signature `(app, options) => void | Promise<void>`:

```ts
import mimi from 'mimi.js';
import type { Plugin } from 'mimi.js';

const helloPlugin: Plugin = (app, options) => {
  const prefix = options.prefix as string ?? '';

  app.get(`${prefix}/hello`, (req, res) => {
    res.json({ message: 'Hello from plugin!' });
  });
};

const app = mimi();
await app.register(helloPlugin, { prefix: '/api' });

// GET /api/hello now works
app.listen(3000);
```

---

## Sync Plugin

Bundle routes and middleware together:

```ts
import type { Plugin } from 'mimi.js';
import { json, cors } from 'mimi.js';

const apiPlugin: Plugin = (app) => {
  app.use('/api', json());
  app.use('/api', cors({ origin: process.env.ALLOWED_ORIGIN }));

  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
};

app.register(apiPlugin);
app.listen(3000);
```

---

## Async Plugin

Use an async plugin when setup requires awaiting something (database, config service, etc.):

```ts
import mimi, { json } from 'mimi.js';
import { mongodbManager } from 'mimi.js';
import type { Plugin } from 'mimi.js';

const databasePlugin: Plugin = async (app, options) => {
  await mongodbManager.connect(options.uri as string);
  console.log('Database connected');

  const User = mongodbManager.createCollection('User', {
    name:  { type: String, required: true },
    email: { type: String, required: true },
  }) as any;

  app.get('/users', async (req, res) => {
    res.json(await User.find());
  });

  app.post('/users', async (req, res) => {
    const user = await User.create(req.body);
    res.status(201).json(user);
  });
};

const app = mimi();
app.use(json());

// register() awaits the plugin before continuing
await app.register(databasePlugin, { uri: process.env.MONGO_URI! });

app.listen(3000);
```

::: warning
`app.register()` returns a `Promise` for async plugins. Always `await` it before calling `app.listen()`.
:::

---

## Composing Multiple Plugins

```ts
// src/main.ts
import mimi, { json, cors, security, requestLogger } from 'mimi.js';
import { authPlugin } from './plugins/auth.plugin';
import { usersPlugin } from './plugins/users.plugin';

const app = mimi();

app.use(json());
app.use(cors());
app.use(security());
app.use(requestLogger);

app.register(authPlugin, { prefix: '/api/v1' });
await app.register(usersPlugin, { dbUri: process.env.MONGO_URI! });

app.setErrorHandler((err, req, res) => {
  const status = (err as any).status ?? 500;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: err.message }));
});

app.listen(Number(process.env.PORT) || 3000);
```

---

## Health Check Plugin

```ts
import type { Plugin } from 'mimi.js';
import os from 'os';

const healthPlugin: Plugin = (app, options) => {
  const version = options.version as string ?? '1.0.0';

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
      host: os.hostname(),
    });
  });
};

app.register(healthPlugin, { version: process.env.npm_package_version });
```

---

## Plugin Type Reference

```ts
type Plugin = (
  app: MimiApp,
  options: Record<string, unknown>,
) => void | Promise<void>;
```

`app.register()` signature:

```ts
register(plugin: Plugin, options?: Record<string, unknown>): this | Promise<this>
```
