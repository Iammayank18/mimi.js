# mimijs v2 — Design Spec

**Date:** 2026-04-19
**Status:** Approved for implementation

---

## Why This Change

Express has held the Node.js framework space for 13 years on inertia. Its core problems are well-known:

- **Linear routing** — O(n) layer scan degrades under many routes
- **No lifecycle hooks** — middleware order is implicit, fragile, and undebuggable
- **No type safety** — `req.body` is `any`; runtime shape errors are silent until production
- **No validation story** — developers assemble `express-validator`, `joi`, `zod`, `celebrate` themselves

mimijs v2 fixes all four without breaking Express compatibility or introducing a new mental model. Developers can migrate one route at a time.

**Target developers:**
1. Express migrants who want to upgrade without rewriting
2. Full-stack TypeScript developers who want production primitives out of the box

**Three differentiators that drive global recognition:**
1. **Performance** — Radix trie router + schema-based serialization
2. **TypeScript-native DX** — Route handlers know `req.body`, `req.params`, `req.query` shapes at compile time via Zod (or any validator)
3. **Lifecycle hooks** — 7 named hook points that make auth, caching, and logging surgically precise

---

## Architecture Overview

The existing core (prototype-patched `req`/`res`, layer stack, plugin system) is preserved. Four targeted upgrades are made:

```
http.createServer(app)
       │
  app(req, res)                    ← mimi() factory (unchanged)
       │
  RadixRouter.match(path, method)  ← NEW: replaces linear layer stack
       │
  RequestContext.create(req, res, matchResult)  ← NEW: created after match, carries route params + hooks
       │
  Lifecycle hook pipeline:
    onRequest      → global guards, IP filtering
    preParsing     → body read from stream (lazy)
    preValidation  → ValidatorAdapter.parse(schema, ctx)
    preHandler     → auth, rate limiting, caching
    handler(ctx)   → route handler (or req/res/next compat)
    onSend         → schema serialization, compression
    onResponse     → logging, metrics
       │
  onError          ← any hook can throw, lands here
       │
  finalhandler     ← 404 catch-all (unchanged)
```

---

## Component 1: Radix Trie Router

**File:** `src/router/radix.ts` (new), replaces `src/router/index.ts` internals

**Why:** The current Layer stack scans linearly — every `app.use()` and `app.get()` entry is checked in order for every request. A radix trie matches in O(log n) regardless of route count. At 100 routes, this is ~7× fewer comparisons.

**Design:**

```typescript
class RadixNode {
  children: Map<string, RadixNode>
  paramChild?: RadixNode          // :id segments
  wildcardChild?: RadixNode       // * segments
  handlers: Map<string, RouteEntry>  // method → { hooks, handler }
}

class RadixRouter {
  insert(method: string, path: string, entry: RouteEntry): void
  match(method: string, path: string): MatchResult | null
  // MatchResult: { handler, params, hooks }
}
```

**Param extraction** — captured during trie traversal, zero regex overhead. `:id` nodes store the param name; wildcard `*` captures remainder.

**Express compatibility** — `app.use(path, middleware)` mounts at a prefix node with `method = '*'`. The radix trie supports prefix matching for middleware the same way it supports exact matching for routes.

**Backward compatibility** — `Router` class exported from `src/router/index.ts` keeps its public API. The internals switch from `Layer[]` to `RadixRouter`. All existing route registration code (`app.get`, `app.post`, `app.use`, `app.route`) works unchanged.

---

## Component 2: Lifecycle Hook Pipeline

**File:** `src/core/hooks.ts` (new), integrated into `src/router/route.ts`

**The 7 hooks in execution order:**

| Hook | Purpose | Typical use |
|------|---------|-------------|
| `onRequest` | First thing after router match | IP allowlist, request ID injection |
| `preParsing` | Before body is read | Request size limits, streaming intercept |
| `preValidation` | After body parsed, before validation | Custom coercion, field normalization |
| `preHandler` | After validation passes | Auth check, rate limit, cache hit |
| `handler` | The route handler itself | Business logic |
| `onSend` | Before response bytes written | Schema serialization, response compression |
| `onResponse` | After response sent (async, non-blocking) | Logging, metrics, cleanup |

Plus one error hook:

| Hook | Purpose |
|------|---------|
| `onError` | Any hook or handler throws | Centralized error shaping |

**Registration API:**

```typescript
// Global hooks — run on every request
app.addHook('onRequest', async (ctx) => {
  ctx.requestId = crypto.randomUUID();
});

// Route-scoped hooks — additional overload, does NOT replace existing multi-handler form
// Old form still works: app.get('/admin', authMiddleware, handler)
app.get('/admin', {
  hooks: {
    preHandler: [authMiddleware, requireRole('admin')],
  },
  handler: async (ctx) => ctx.json({ secret: true }),
});
```

**Express middleware compatibility** — existing `(req, res, next)` middleware mounts at `preHandler` by default when registered via `app.use()`. No change to existing code.

**Hook implementation** — each hook slot is an ordered array of async functions. The pipeline runs them with `for...of` + `await`. Throwing inside any hook skips to `onError`. The `onResponse` hook runs after `res.end()` via the existing `res.on('finish')` pattern.

---

## Component 3: RequestContext

**File:** `src/core/context.ts` (new)

**Design:** A plain object created once per request. Not a class instance — object literal for V8 optimization. The factory function `createContext(req, res)` is called by the router after a match.

```typescript
interface RequestContext<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery extends Record<string, string> = Record<string, string>,
> {
  // Raw Node primitives
  req: MimiRequest
  res: MimiResponse

  // Typed data (set by ValidatorAdapter)
  body: TBody
  params: TParams
  query: TQuery

  // Request metadata
  requestId: string
  startTime: number
  ip: string
  method: string
  path: string

  // Response helpers (delegates to res)
  json(data: unknown, status?: number): void
  send(data: unknown, status?: number): void
  html(data: string, status?: number): void
  redirect(url: string, status?: number): void
  status(code: number): RequestContext<TBody, TParams, TQuery>
  set(header: string, value: string): RequestContext<TBody, TParams, TQuery>

  // Request helpers
  get(header: string): string | undefined
  is(contentType: string): string | false

  // Scoped storage (replaces req.locals)
  store: Record<string, unknown>
}
```

**Handler detection** — the route dispatcher checks `handler.length`:
- 1 argument → `async (ctx) => {}` style, passes `ctx`
- 2–3 arguments → `(req, res, next)` style, passes `ctx.req`, `ctx.res`, `next`

This means zero migration cost. Existing Express-style handlers work without changes.

**TypeScript flow** — when a route is defined with a Zod schema, the generic parameters of `RequestContext` are inferred automatically:

```typescript
app.post('/users',
  validate({ body: CreateUserSchema, params: z.object({ id: z.string() }) }),
  async (ctx) => {
    ctx.body.name   // ✅ string — no `as any`
    ctx.params.id   // ✅ string
  }
);
```

---

## Component 4: ValidatorAdapter + Zod Default

**Files:** `src/validation/adapter.ts`, `src/validation/zod.ts`, `src/validation/index.ts`

**Adapter interface:**

```typescript
interface ValidatorAdapter {
  parse<T>(schema: unknown, data: unknown): T       // throws on invalid
  parseAsync<T>(schema: unknown, data: unknown): Promise<T>
  isSchema(value: unknown): boolean                 // duck-type check
  toOpenAPI?(schema: unknown): object               // optional: for auto-docs
}
```

**Zod default adapter** (`src/validation/zod.ts`):

Requires `zod-to-json-schema` as a peer dependency (added to `devDependencies` + listed as optional `peerDependencies` so it's not forced on users who don't need OpenAPI).

```typescript
export const zodAdapter: ValidatorAdapter = {
  parse: (schema, data) => (schema as ZodType).parse(data),
  parseAsync: (schema, data) => (schema as ZodType).parseAsync(data),
  isSchema: (v) => v instanceof ZodType,
  toOpenAPI: (schema) => zodToOpenAPI(schema as ZodType),  // via zod-to-json-schema
};
```

**`validate()` middleware factory** — plugs into `preValidation` hook:

```typescript
interface ValidationTargets {
  body?: unknown      // any schema the adapter accepts
  params?: unknown
  query?: unknown
  headers?: unknown
}

function validate(targets: ValidationTargets): RequestHandler {
  return async (ctx, next) => {
    if (targets.body)   ctx.body   = await adapter.parseAsync(targets.body, ctx.req.body);
    if (targets.params) ctx.params = await adapter.parseAsync(targets.params, ctx.req.params);
    if (targets.query)  ctx.query  = await adapter.parseAsync(targets.query, ctx.req.query);
    next();
  };
}
```

**Validation errors** produce a `400` response automatically with a structured error body:

```json
{
  "error": "Validation failed",
  "issues": [{ "path": ["body", "email"], "message": "Invalid email" }]
}
```

**Swapping the adapter** — global replacement:

```typescript
import { setAdapter } from 'mimi.js/validation';
import { valibotAdapter } from '@mimi.js/valibot';
setAdapter(valibotAdapter);
```

---

## Component 5: Auto OpenAPI from Schemas

**File:** `src/swagger/index.ts` (extended, not replaced)

`setupSwagger()` gains an `autoSpec` mode. When routes are registered with `validate()` schemas that have a `toOpenAPI` adapter method, the framework collects those schemas at startup and merges them into the spec:

```typescript
setupSwagger(app, {
  info: { title: 'My API', version: '2.0.0' },
  autoSpec: true,  // collect Zod schemas from validate() calls
});
```

The route registry keeps a `Map<string, RouteEntry>` where each entry optionally carries the validation schemas. At `/api-docs/swagger.json` generation time, these are converted via `adapter.toOpenAPI()` and merged into path items.

This eliminates hand-written JSDoc swagger annotations for routes that already have Zod schemas.

---

## Component 6: Built-in Rate Limiting

**File:** `src/middleware/rateLimit.ts`

In-memory token bucket per IP. No Redis dependency for single-instance use (Redis adapter is a future plugin).

```typescript
interface RateLimitOptions {
  windowMs: number          // default: 60_000 (1 min)
  max: number               // default: 100 requests per window
  keyBy?: (ctx: RequestContext) => string  // default: ctx.ip
  onExceeded?: (ctx: RequestContext) => void
}

export function rateLimit(options: RateLimitOptions = {}): RequestHandler
```

Mounts at `preHandler` hook. Responds `429 Too Many Requests` with `Retry-After` header when exceeded. Automatically cleans up expired windows every `windowMs` to prevent memory leaks.

---

## Component 7: Graceful Shutdown

**File:** `src/core/application.ts` (extended)

```typescript
app.listen(3000, () => console.log('up'));

// New: graceful shutdown with drain timeout
app.close(timeoutMs?: number): Promise<void>
```

Implementation:
1. Stop accepting new connections (`server.close()`)
2. Wait for in-flight requests to finish (tracked via `onRequest` / `onResponse` hooks)
3. Force-close after `timeoutMs` (default: 10s)
4. Run `onClose` hooks (database disconnects, flush logs)

```typescript
app.addHook('onClose', async () => {
  await db.disconnect();
  logger.flush();
});

process.on('SIGTERM', () => app.close().then(() => process.exit(0)));
```

---

## File Change Map

| File | Change |
|------|--------|
| `src/router/radix.ts` | **New** — RadixNode + RadixRouter |
| `src/router/index.ts` | **Modify** — swap internals to RadixRouter, keep public API |
| `src/router/route.ts` | **Modify** — add hook pipeline to dispatch() |
| `src/core/context.ts` | **New** — RequestContext factory + type |
| `src/core/application.ts` | **Modify** — add addHook(), close(), handler detection |
| `src/core/hooks.ts` | **New** — HookRegistry, 7 hook slots |
| `src/validation/adapter.ts` | **New** — ValidatorAdapter interface |
| `src/validation/zod.ts` | **New** — Zod adapter implementation |
| `src/validation/index.ts` | **New** — validate() factory, setAdapter() |
| `src/middleware/rateLimit.ts` | **New** — token bucket rate limiter |
| `src/swagger/index.ts` | **Modify** — autoSpec mode from route registry |
| `src/types/index.ts` | **Modify** — add RequestContext, Hook types |
| `src/index.ts` | **Modify** — export new APIs |

---

## Error Handling

All thrown errors (sync or async, in any hook or handler) are caught by the router and routed to the `onError` hook chain. The default `onError` handler:

- Reads `err.status` or `err.statusCode` for the HTTP status (defaults to 500)
- Reads `err.message` for the response message
- Responds with `{ error: string, issues?: array }` JSON

Custom global error handler:

```typescript
app.addHook('onError', (err, ctx) => {
  if (err instanceof DatabaseError) {
    ctx.status(503).json({ error: 'Service unavailable' });
  }
});
```

Validation errors from `ValidatorAdapter.parse()` automatically set `err.status = 400` and `err.issues` before throwing, so the default handler formats them correctly without custom code.

---

## Testing Strategy

Each new component is independently testable:

| Component | Test approach |
|-----------|--------------|
| RadixRouter | Unit test: insert routes, match paths, verify params extracted |
| Hook pipeline | Unit test: mock ctx, assert hooks run in order, assert skip on throw |
| RequestContext | Unit test: create with mock req/res, assert helpers delegate correctly |
| ValidatorAdapter | Unit test: parse valid/invalid against Zod schema, assert error shape |
| validate() middleware | Integration: POST with bad body → assert 400 + issues array |
| rateLimit() | Integration: exceed max in window → assert 429 + Retry-After |
| Graceful shutdown | Integration: send request, SIGTERM mid-flight, assert response completes |
| Express compat | Integration: mount express-style (req,res,next) handler, assert it works |

---

## Versioning

This is a **non-breaking minor version** — all existing mimijs v1 code continues to work. The new APIs are purely additive:
- `addHook()` is new
- `validate()` is new
- `ctx` style handlers are new
- `app.close()` is new
- All v1 exports remain unchanged

Version bump: `2.0.0` → `2.1.0`
