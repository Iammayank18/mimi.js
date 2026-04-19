# mimijs Codebase Context

> This file is intended for AI assistants (e.g. Claude Code). It provides a complete picture of the codebase so exploration is minimal.

---

## What This Is

**mimijs** (`mimi.js` on npm) is a **standalone TypeScript HTTP framework** — no Express dependency. It exposes an Express-compatible API and ships compiled JavaScript + `.d.ts` declarations from `dist/`.

- **Source**: `src/` (TypeScript)
- **Output**: `dist/` (compiled, what npm publishes)
- **Entry**: `src/index.ts` → `dist/index.js` + `dist/index.d.ts`

---

## Architecture Overview

```
http.createServer(app)          ← Node native HTTP
       │
  app(req, res)                 ← callable function created by mimi()
       │
  Router.handle()               ← Layer stack traversal
       │
  Layer.match(path)             ← path-to-regexp regex match
       │
  Route.dispatch()  ──or──  Middleware fn(req, res, next)
       │
  finalhandler(req, res)        ← 404 / error catch-all
```

**Key design decisions:**
1. **Prototype patching** — `src/core/request.ts` and `src/core/response.ts` patch `http.IncomingMessage.prototype` and `http.ServerResponse.prototype` once at import time. This makes third-party Express middleware work without adaptation.
2. **Layer-based routing** — identical to Express internals. `use()` layers have `end: false` (prefix match); `route()` layers have `end: true` (exact match).
3. **Error handler detection** — `fn.length === 4` means it's an error handler; `fn.length <= 3` means normal middleware.
4. **Opt-in middleware** — `mimi()` returns a bare app. Users explicitly call `app.use(cors())`, `app.use(json())`, etc.
5. **path-to-regexp pinned to v6** — v6 has the 3-argument API `pathToRegexp(path, keys, opts)` used in `layer.ts`. v7+ dropped it.

---

## Source File Map

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry — re-exports everything |
| `src/types/index.ts` | All shared TypeScript types + `http` module augmentation |
| `src/core/request.ts` | Side-effect: patches `IncomingMessage.prototype` with `req.get`, `req.query`, `req.path`, `req.ip`, `req.hostname`, `req.is`, `req.params`, `req.body` |
| `src/core/response.ts` | Side-effect: patches `ServerResponse.prototype` with `res.status`, `res.set`, `res.type`, `res.json`, `res.send`, `res.redirect`, `res.sendStatus` |
| `src/core/finalhandler.ts` | Default 404 + error response — never throws |
| `src/core/application.ts` | `mimi()` factory — creates Router, mixes in methods, wraps `http.createServer` |
| `src/router/layer.ts` | `Layer` class — path-to-regexp matching, param extraction, arity-based error handler detection |
| `src/router/route.ts` | `Route` class — method-specific handler dispatch, `next('route')` support |
| `src/router/index.ts` | `Router` class — stack traversal, `use()` / `route()` / HTTP shortcuts |
| `src/plugins/index.ts` | `createRegister(app)` — returns `app.register(plugin, opts)` function |
| `src/middleware/logger.ts` | Winston logger + `requestLogger` middleware (logs method/url/status/ms) |
| `src/middleware/bodyParser.ts` | `json(opts)` and `urlencoded(opts)` factories using `raw-body` |
| `src/middleware/cors.ts` | `cors(opts)` — zero-dep CORS, handles OPTIONS preflight |
| `src/middleware/security.ts` | `security(opts)` — security headers (CSP, X-Frame-Options, etc.) |
| `src/middleware/static.ts` | `serveStatic(root, opts)` — static file serving via `send` package |
| `src/middleware/index.ts` | Barrel export for all middleware |
| `src/parsers/customParser.ts` | Stub: sets `req.body = {}` for `application/custom` content-type |
| `src/swagger/index.ts` | `setupSwagger(app, opts)` — registers `/api-docs` (CDN SwaggerUI) and `/api-docs/swagger.json` |
| `src/auth/authHelper.ts` | `hashPassword`, `comparePassword`, `generateToken`, `verifyToken` |
| `src/auth/authMiddleware.ts` | `authMiddleware` — Bearer token extraction + JWT verify (null-safe) |
| `src/auth/index.ts` | Barrel export for auth |
| `src/db/mongodb/index.ts` | `mongodbManager` — Singleton, Mongoose-based, `connect()` + `createCollection()` |
| `src/db/sqllite/index.ts` | `SQLiteManager` — Singleton, Sequelize+sqlite3, `connect()` + `createModel()` |
| `src/router-loader.ts` | Scans `process.cwd()/routes/*.js` at startup and mounts them on the app |

---

## Public API (all from `dist/index.js`)

```typescript
// Default export
import mimi from 'mimi.js';
const app = mimi();            // bare app, no default middleware

// Named exports
import {
  // Middleware factories (opt-in)
  json, urlencoded, cors, security, serveStatic, requestLogger, customParser,

  // Auth utilities
  hashPassword, comparePassword, generateToken, verifyToken, authMiddleware,

  // Swagger
  setupSwagger,

  // Router (for sub-routers)
  Router,

  // Database managers
  mongodbManager, SQLiteManager,

  // Logger instance (winston)
  logger,
} from 'mimi.js';

// Types
import type {
  MimiApp, MimiRequest, MimiResponse,
  RequestHandler, ErrorHandler, NextFunction,
  Middleware, Plugin, Route, TokenPayload,
} from 'mimi.js';
```

### App API (same as Express)
```typescript
app.use('/prefix', middleware)
app.get('/path', handler)
app.post('/path', handler)
// put, patch, delete, head, options, all — same pattern
app.route('/path').get(h1).post(h2)
app.listen(3000, callback)
app.register(plugin, options)  // new: plugin system
```

---

## Dependency Rationale

| Package | Why |
|---------|-----|
| `path-to-regexp@^6` | Route regex matching — **must stay on v6**; v7 broke 3-arg API |
| `raw-body` | Read stream body for body parsers |
| `mime-types` | MIME type resolution in `req.is()` and `res.type()` |
| `send` | Static file serving with ETag/range support |
| `swagger-jsdoc` | Generates OpenAPI 3.0 spec from JSDoc comments |
| `qs` | Extended URL-encoded body parsing (nested objects) |
| `content-type` | Content-Type header parsing (available but used via mime-types) |
| `bcrypt` + `jsonwebtoken` | Auth utilities |
| `mongoose` | MongoDB ODM for `mongodbManager` |
| `sequelize` + `sqlite3` | ORM for `SQLiteManager` |
| `winston` | Structured logging |
| `dotenv` | Loads `.env` on import of `src/index.ts` |

---

## Bugs Fixed in This Rewrite

1. **`authMiddleware` crash** — old code called `.split()` on `req.headers.authorization` without null-checking. Fixed in `src/auth/authMiddleware.ts`.
2. **SQLite `connect()` singleton break** — old code created a fresh `new Sequelize(...)` inside `connect()`, disconnecting it from the singleton's models. Fixed in `src/db/sqllite/index.ts`.
3. **SQLite typo** — `ressolve` → standard `resolve`.

---

## Build

```bash
npm install
npm run build    # tsc → dist/
npm run dev      # ts-node src/index.ts (for development)
npm run clean    # rm -rf dist
```

The `prepublishOnly` hook runs `build` automatically before `npm publish`.

---

## Constraints & Notes

- `src/core/request.ts` and `src/core/response.ts` must be imported **before** any request is handled. They are side-effect imports in `src/core/application.ts`.
- `mimi()` auto-loads `routes/*.js` from `process.cwd()`. If no `routes/` directory exists, it silently skips.
- `JWT_SECRET` env var is required for auth helpers — they throw if missing.
- Third-party Express middleware (e.g. `helmet`, `cors` npm package) works because the prototype patching makes `req`/`res` compatible.
