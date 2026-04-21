# Changelog

All notable changes to mimi.js are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning: [Semantic Versioning](https://semver.org/)

Full changelog with guides: [iammayank18.github.io/mimi.js/changelog](https://iammayank18.github.io/mimi.js/changelog)

---

## [Unreleased] — v2.1.0

### Performance
- URL parsed once per request — eliminates ~86k allocations/second under load
- winston replaced with pino — 7× faster logging, −6 MB RSS
- mongoose/sequelize/bcrypt moved to optional peer deps — −20 MB RSS

### Features
- `app.setErrorHandler(fn)` — global structured error handler
- `app.addHook(name, fn)` — 7 lifecycle hooks (onRequest → onClose)
- `app.close([timeoutMs])` — graceful shutdown with drain
- `validate(targets)` — request validation middleware (Zod built-in, pluggable)
- `rateLimit(options)` — token-bucket rate limiter
- `RequestContext` + ctx-style handlers

---

## [2.0.0] — 2024

Full TypeScript rewrite. Radix trie router via `find-my-way` (89k req/s simple, 88k req/s at 50 routes — flat across all scenarios). Custom HTTP router, typed req/res, plugin system, JWT auth, MongoDB/SQLite adapters, Swagger UI, auto route loader. See [full changelog](https://iammayank18.github.io/mimi.js/changelog).

---

## [1.x] — 2023–2024

Original JavaScript implementation. Express wrapper with auth, DB helpers, and auto route loading.
