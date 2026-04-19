---
title: API Reference
outline: deep
---

# API Reference

## MimiApp

### HTTP Method Handlers

All return `this` for chaining.

```typescript
app.get(path: string, ...handlers: RequestHandler[]): MimiApp
app.post(path: string, ...handlers: RequestHandler[]): MimiApp
app.put(path: string, ...handlers: RequestHandler[]): MimiApp
app.patch(path: string, ...handlers: RequestHandler[]): MimiApp
app.delete(path: string, ...handlers: RequestHandler[]): MimiApp
app.head(path: string, ...handlers: RequestHandler[]): MimiApp
app.options(path: string, ...handlers: RequestHandler[]): MimiApp
app.all(path: string, ...handlers: RequestHandler[]): MimiApp
```

### `app.use([path], ...middleware)`

Mounts middleware globally or at a path prefix.

```typescript
app.use(json())                    // global
app.use('/api', authMiddleware)    // prefix-scoped
app.use('/api', router)            // mount a Router
```

### `app.route(path)` → `Route`

Returns a `Route` object for chaining multiple HTTP methods on the same path.

```typescript
app.route('/users')
  .get(listUsers)
  .post(createUser);
```

### `app.listen(port, [callback])` → `http.Server`

Starts the HTTP server on the given port.

```typescript
const server = app.listen(3000, () => console.log('Ready'));
```

### `app.register(plugin, [options])` → `MimiApp | Promise<MimiApp>`

Registers a plugin. Supports both sync and async plugins.

```typescript
app.register(myPlugin, { option: 'value' });
await app.register(asyncPlugin);
```

## MimiResponse

Extends Node's `http.ServerResponse`.

| Method | Signature | Description |
|--------|-----------|-------------|
| `res.status(code)` | `(code: number) => this` | Set status code, returns `res` |
| `res.json(obj)` | `(obj: unknown) => void` | Send JSON with `Content-Type: application/json` |
| `res.send(body)` | `(body: unknown) => void` | Send response (auto-detects type) |
| `res.sendStatus(code)` | `(code: number) => void` | Send status + its text as body |
| `res.redirect(url, [status])` | `(url: string, status?: number) => void` | Redirect (default 302) |
| `res.set(field, value)` | `(field: string, value: string) => this` | Set response header |
| `res.set(obj)` | `(obj: Record<string, string>) => this` | Set multiple headers at once |
| `res.type(contentType)` | `(contentType: string) => this` | Set `Content-Type` |
| `res.locals` | `Record<string, unknown>` | Per-request storage |

## Middleware Factories

### `json(options?)`

```typescript
import { json } from 'mimi.js';
app.use(json({ limit: '1mb' }));
```

### `urlencoded(options?)`

```typescript
import { urlencoded } from 'mimi.js';
app.use(urlencoded({ extended: true }));
```

### `cors(options?)`

```typescript
import { cors } from 'mimi.js';
app.use(cors({ origin: 'https://example.com', credentials: true }));
```

Full options: `origin`, `methods`, `allowedHeaders`, `exposedHeaders`, `credentials`, `maxAge`.

### `security(options?)`

```typescript
import { security } from 'mimi.js';
app.use(security({ contentSecurityPolicy: false }));
```

### `serveStatic(root, options?)`

```typescript
import { serveStatic } from 'mimi.js';
app.use(serveStatic('./public', { maxAge: 86400000 }));
```

### `requestLogger`

```typescript
import { requestLogger } from 'mimi.js';
app.use(requestLogger);
```

### `customParser`

```typescript
import { customParser } from 'mimi.js';
app.use(customParser);
```

## Database

### `mongodbManager`

Requires `npm install mongoose`.

```typescript
import { mongodbManager } from 'mimi.js';

await mongodbManager.connect('mongodb://localhost:27017/mydb');
await mongodbManager.disconnect();
const conn = mongodbManager.connection; // mongoose.Connection | null
```

### `SQLiteManager`

Requires `npm install sequelize sqlite3`.

```typescript
import { SQLiteManager } from 'mimi.js';

const db = new SQLiteManager('./data.sqlite'); // or ':memory:'
await db.connect();
await db.disconnect();
const seq = db.instance; // Sequelize instance
```

## Plugin

```typescript
import type { Plugin } from 'mimi.js';

const myPlugin: Plugin = (app, options) => {
  app.use(someMiddleware);
  app.get('/plugin-route', handler);
};

app.register(myPlugin, { key: 'value' });
```

