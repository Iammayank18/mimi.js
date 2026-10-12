# Changelog

All notable changes to mimi.js are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning: [Semantic Versioning](https://semver.org/)

Full changelog with guides: [iammayank18.github.io/mimi.js/changelog](https://iammayank18.github.io/mimi.js/changelog)

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

## [2.0.0] — 2024

Full TypeScript rewrite. Radix trie router via `find-my-way` (89k req/s simple, 88k req/s at 50 routes — flat across all scenarios). Custom HTTP router, typed req/res, plugin system, JWT auth, MongoDB/SQLite adapters, Swagger UI, auto route loader. See [full changelog](https://iammayank18.github.io/mimi.js/changelog).

---

## [1.x] — 2023–2024

Original JavaScript implementation. Express wrapper with auth, DB helpers, and auto route loading.
