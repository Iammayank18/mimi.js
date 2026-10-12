---
title: Changelog
nav_order: 4
---

# Changelog

All notable changes to mimi.js are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [2.1.0] — 2026-10-13

### Added — agent-native layer
- **Actions** — `agent(app).action(name, spec)`: one definition served as a REST route, an MCP tool (`/mcp`), `/.well-known/agent.json`, `/llms.txt` and the OpenAPI registry
- Dry-run plans (`ctx.effect`), idempotency keys + agent auto-dedupe, human approval gates, RFC 9457 errors with `fix`/`suggest`/`example`, receipts and undo
- Caller identity (MCP, `X-Agent-Id`, `Signature-Agent`, known agent user-agents), per-agent rate and spend budgets, audit log, agent-DX insights
- Intent search (`/_agent/find`) and progressive MCP disclosure for large APIs
- **Plugins** — `ai.use(plugin)` with `setup`, `onRegister`, `beforeCall`, `approval`, `afterCall`, `onEvent`, custom MCP `tools` and `routes`; options `rank`, `agentPatterns`, `formatResponse`, `problemBaseUrl`, `store`, `identify`
- Built-in plugins: `redact`, `scopes`, `approvalRule`, `requireUndo`, `auditLog`, `cacheReads`
- `AgentKit` for in-process calls (`kit.call()`) with the same contract

### Added — core
- `invalidateToken()` and `setTokenStore()` — JWT revocation with a pluggable store
- `requestId()` middleware and `logError`; request logs include the request id
- `mimi()` options: `requestTimeout`, `keepAliveTimeout` (default 65 s), `processErrorHandlers`, `logger`
- `app.close(callback)` closes every server opened with `app.listen()`
- `req.id`, `req.app`; `app.use()` accepts routers

### Fixed
- TypeScript build error in `application.ts` (server timeout callback typing)

### Notes
- `zod` is an optional peer dependency (`>=3.23`); Zod v4 is recommended for the agent layer.
- No breaking changes.

---

## [2.0.5] — 2026-05-12

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
- **Swagger UI** — `setupSwagger(app, options)` serves `/api-docs`. Zod-schema-based route docs added in v2.0.5.
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
