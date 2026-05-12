---
title: Changelog
nav_order: 4
---

# Changelog

All notable changes to mimi.js are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — v2.1.0

> Production-readiness upgrade. All changes are backward-compatible.

### Performance
- **URL parsed once per request** — `req.path` and `req.query` now memoize on first access instead of calling `new URL()` on every read. Eliminates ~86k allocations/second under load.
- **Logger replaced** — winston → pino. 7× faster structured logging, −6 MB RSS per process.
- **Heavyweight deps moved to peer** — `mongoose`, `sequelize`, `sqlite3`, `bcrypt` are now optional peer dependencies. Applications that don't use database features save 20+ MB RSS per process.

### Features
- `app.setErrorHandler(fn)` — register a global error handler that intercepts all `next(err)` calls before the default 500 response.
- `app.addHook(name, fn)` — lifecycle hooks at 7 named points: `onRequest`, `preParsing`, `preValidation`, `preHandler`, `onSend`, `onResponse`, `onError`.
- `app.close([timeoutMs])` — graceful shutdown: stops accepting connections, drains in-flight requests, fires `onClose` hooks.
- `validate(targets)` — request validation middleware factory. Validates `body`, `params`, `query` against any schema adapter.
- Built-in **Zod adapter** — `validate({ body: z.object({...}) })` with structured 400 responses.
- `setAdapter(adapter)` — swap the validation backend (Zod, Valibot, Joi, etc.) globally.
- `rateLimit(options)` — token-bucket rate limiter with per-IP tracking and `X-RateLimit-*` headers.
- `RequestContext` — per-request context object (`ctx`) with typed `body`, `params`, `query`, `store`, and response helpers.
- **Ctx-style handlers** — `app.get('/path', async (ctx) => { ctx.json(...) })` as an alternative to `(req, res, next)`.

### Developer Experience
- **vitest** test infrastructure with V8 coverage.
- All new APIs exported from the main entry point with full TypeScript declarations.
- Graceful install-hint errors when optional peer deps are missing.

---

## [2.0.3] — 2026-05-12

### Added
- **Schema-based route documentation** — pass a `RouteSchema` object (with Zod schemas) as the second argument to any route method. The framework validates the request and generates the OpenAPI operation automatically. JSDoc `@openapi` comment parsing has been removed.
- **`mimi({ docs })` zero-config option** — pass a `docs` key to the `mimi()` factory to enable Swagger UI with no extra imports or function calls. `setupSwagger()` is still available for manual control.
- **Local Swagger UI assets** — `swagger-ui-dist` is served from the local npm package at `/api-docs/_static`. No CDN, no `unpkg.com`, no Content Security Policy overrides needed.
- **Security scheme support** — define `components.securitySchemes` in the `docs` config and add `security: [{ schemeName: [] }]` on individual routes to show the lock icon and Authorize button in Swagger UI.
- **Global security** — pass `security` at the top level of `docs` to apply it to all routes at once.
- **`MimiOptions` type** — exported interface for the `mimi()` factory options.
- **`SwaggerOptions` / `SecurityScheme` types** — exported interfaces for swagger configuration.
- **Additional `MimiRequest` methods** — `header()`, `accepts()`, `acceptsCharsets()`, `acceptsEncodings()`, `acceptsLanguages()`, `range()`, and properties `host`, `ips`, `protocol`, `secure`, `xhr`, `fresh`, `stale`, `subdomains`.
- **Additional `MimiResponse` methods** — `header()`, `get()`, `contentType()`, `jsonp()`, `sendFile()`, `download()`, `attachment()`, `append()`, `location()`, `vary()`, `links()`, `cookie()`, `clearCookie()`, `format()`.

### Fixed
- **Router URL stripping bug** — `req.url` was incorrectly stripped for route layers as well as middleware layers, causing every route's trie lookup to fail when mounted under a prefix. Stripping now only applies to `use()` middleware layers (identified via `layer.route`).
- **XSS in Swagger HTML** — `options.info.title` is now escaped before being injected into the `<title>` tag.
- **Helpful install error** — when `swagger-ui-dist` is not installed, the framework now throws a clear message with the `npm install` command instead of crashing with `MODULE_NOT_FOUND`.
- **Double registration guard** — calling both `mimi({ docs })` and `setupSwagger()` no longer registers the `/api-docs` routes twice.

---

## [2.0.0] — 2024

### Breaking Changes
- Full TypeScript rewrite. The package now ships compiled `.js` + `.d.ts` declarations from a `src/` TypeScript source tree.
- `main` entry changed from `lib/index.js` to `dist/index.js`.
- `mimi()` now returns a `MimiApp` typed interface.

### Added
- **Radix trie router** via `find-my-way` — route lookup is O(path depth), not O(route count). 50-route throughput stays flat at 88,305 req/s (was 42,992 req/s with linear scan).
- **Custom HTTP router** — `Router` class with `Layer`/`Route` internals. Express-compatible `app.get/post/put/patch/delete/head/options/all` API.
- **Prototype-augmented `req`/`res`** — `req.params`, `req.query`, `req.body`, `req.path`, `req.hostname`, `req.ip`, `req.locals`, `req.get()`, `req.is()`. `res.status()`, `res.json()`, `res.send()`, `res.redirect()`, `res.sendStatus()`, `res.set()`, `res.type()`.
- **Body parsing** — `json()`, `urlencoded()`, `customParser` (raw-body based).
- **CORS middleware** — `cors()` with origin function, credentials, maxAge.
- **Security headers** — `security()` sets CSP, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, X-DNS-Prefetch-Control.
- **Static file serving** — `serveStatic()`.
- **Structured logging** — `requestLogger` middleware, `logger` instance (winston → pino in v2.1).
- **JWT auth** — `generateToken`, `verifyToken`, `authMiddleware`.
- **Password hashing** — `hashPassword`, `comparePassword` (bcrypt).
- **MongoDB adapter** — `mongodbManager` singleton.
- **SQLite adapter** — `SQLiteManager` class (Sequelize + sqlite3).
- **Swagger UI** — `setupSwagger(app, options)` serves `/api-docs`. Zod-schema-based route docs added in v2.0.3.
- **Auto route loader** — scans `./routes/*.js` at startup and mounts each file.
- **Plugin system** — `app.register(plugin, options)` with async support.
- **`async` handler support** — errors from async handlers automatically forwarded to `next`.
- Full TypeScript declarations for all exports.

---

## [1.x] — 2023–2024

The original JavaScript implementation (`lib/` directory).

### Key features in v1
- `mimi()` factory wrapping Express with pre-configured middleware
- JWT + bcrypt auth utilities
- MongoDB and SQLite wrappers
- Auto-route loading from `./routes/`
- express-jsdoc-swagger integration
- Winston request logger

---

## Versioning Policy

- **Patch** (`2.x.Y`) — bug fixes, performance improvements, documentation
- **Minor** (`2.Y.0`) — new features, backward-compatible
- **Major** (`X.0.0`) — breaking API changes, announced in advance
