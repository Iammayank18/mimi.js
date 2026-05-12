---
title: Swagger / OpenAPI
outline: deep
---

# Swagger / OpenAPI

mimi.js generates OpenAPI 3.0 docs **automatically from your route definitions** — no JSDoc comments, no separate YAML files. Define your route once with a Zod schema and the docs appear.

Swagger UI assets are served from a local npm package (`swagger-ui-dist`), so there is **no CDN dependency and no Content Security Policy setup** needed.

---

## Setup

Install `zod` if you haven't already:

```bash
npm install zod
```

### Option A — Zero-config (recommended)

Pass a `docs` option to `mimi()`. That's it.

```ts
import mimi from 'mimi.js';

const app = mimi({
  docs: {
    info: { title: 'My API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  },
});

app.listen(3000);
```

- Swagger UI → `http://localhost:3000/api-docs`
- Raw OpenAPI JSON → `http://localhost:3000/api-docs/swagger.json`

### Option B — Explicit call

If you prefer to control when docs are set up (for example, after middleware), use `setupSwagger` directly:

```ts
import mimi, { json, setupSwagger } from 'mimi.js';

const app = mimi();
app.use(json());

setupSwagger(app, {
  info: { title: 'My API', version: '1.0.0' },
  servers: [{ url: 'http://localhost:3000' }],
});

app.listen(3000);
```

Both options produce the same result. Use whichever feels cleaner for your project.

::: tip No CDN, no CSP
Swagger UI loads its CSS and JS from the local `swagger-ui-dist` package — nothing is fetched from `unpkg.com` or any other CDN. You do **not** need to add any Content Security Policy overrides.
:::

---

## Documenting Routes

Pass a `RouteSchema` object as the **second argument** to any route method. The framework uses it to:

1. **Validate** the incoming request (params, query, body, headers) — returns `422` automatically on failure
2. **Generate** the OpenAPI operation in the spec

```ts
import { Router } from 'mimi.js';
import { z } from 'zod';

const router = new Router();

const UserSchema = z.object({
  id:    z.string().uuid(),
  name:  z.string().min(1),
  email: z.string().email(),
});

router.get('/users/:id', {
  summary:     'Get user by ID',
  description: 'Returns a single user. Returns 404 if not found.',
  tags:        ['users'],
  params:      z.object({ id: z.string().uuid() }),
  response:    { 200: UserSchema, 404: z.object({ error: z.string() }) },
}, async (req, res) => {
  // req.params.id has already been validated as a UUID
  res.json({ id: req.params.id, name: 'Alice', email: 'alice@example.com' });
});

export default router;
```

---

## RouteSchema Reference

All fields are optional — include only what you need.

| Field | Type | Description |
|---|---|---|
| `summary` | `string` | Short title shown at the top of the operation in Swagger UI |
| `description` | `string` | Longer description of what the endpoint does |
| `tags` | `string[]` | Groups operations into sections in the sidebar |
| `deprecated` | `boolean` | Strikes through the operation in Swagger UI |
| `security` | `Record<string, string[]>[]` | Shows a lock icon on this route — see [Authentication](#authentication-lock-icon) |
| `params` | `ZodSchema` | Validates `req.params`; generates path parameters |
| `query` | `ZodSchema` | Validates `req.query`; generates query parameters |
| `headers` | `ZodSchema` | Validates `req.headers`; generates header parameters |
| `body` | `ZodSchema` | Validates `req.body`; generates the `requestBody` |
| `response` | `Record<number, ZodSchema>` | Maps HTTP status codes to response schemas |

---

## Authentication (lock icon)

When an endpoint requires a token, you want Swagger UI to show a **lock icon** on that route and an **Authorize** button at the top of the page. This is a two-step process.

### Step 1 — Define the scheme

Tell Swagger UI what kind of auth your API uses. Add a `components.securitySchemes` entry to your `docs` config:

```ts
const app = mimi({
  docs: {
    info: { title: 'My API', version: '1.0.0' },
    components: {
      securitySchemes: {
        // Pick a name — you'll reference it on each route
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});
```

This makes the **Authorize** button appear at the top of Swagger UI. Clicking it opens a dialog where you can paste your JWT token. Swagger UI then sends `Authorization: Bearer <token>` on every "Try it out" request.

### Step 2 — Mark protected routes

Add a `security` field to each route that requires authentication:

```ts
router.get('/todos', {
  summary:  'List todos',
  tags:     ['todos'],
  security: [{ bearerAuth: [] }],  // ← lock icon appears on this route
  response: { 200: z.array(TodoSchema) },
}, authMiddleware, handler);
```

::: tip Why is the array empty?
The `[]` in `{ bearerAuth: [] }` is a list of **OAuth2 scopes**. For Bearer tokens and API keys, scopes don't apply, so the array is always empty. This is just how the OpenAPI 3.0 spec works. For OAuth2, you'd write `{ oauth2: ['read:todos', 'write:todos'] }`.
:::

### Apply auth to every route at once

If your entire API is protected, pass `security` at the top level instead of on each route:

```ts
const app = mimi({
  docs: {
    info: { title: 'My API', version: '1.0.0' },
    security: [{ bearerAuth: [] }],  // ← applies to all routes
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
});
```

### Other scheme types

```ts
components: {
  securitySchemes: {
    // API key sent in a request header
    apiKey: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
    },
    // HTTP Basic auth (username + password)
    basicAuth: {
      type: 'http',
      scheme: 'basic',
    },
  },
},
```

---

## Examples

### GET with path parameter

```ts
router.get('/users/:id', {
  summary:  'Get user by ID',
  tags:     ['users'],
  params:   z.object({ id: z.string().uuid() }),
  response: {
    200: UserSchema,
    404: z.object({ error: z.string() }),
  },
}, (req, res) => {
  res.json({ id: req.params.id });
});
```

### POST with request body

```ts
const CreateUserSchema = z.object({
  name:  z.string().min(1),
  email: z.string().email(),
});

router.post('/users', {
  summary:  'Create a user',
  tags:     ['users'],
  body:     CreateUserSchema,
  response: {
    201: UserSchema,
    422: z.object({ error: z.string(), issues: z.array(z.any()) }),
  },
}, (req, res) => {
  const body = req.body as z.infer<typeof CreateUserSchema>;
  res.status(201).json({ id: crypto.randomUUID(), ...body });
});
```

### GET with query parameters

```ts
router.get('/users', {
  summary: 'List users',
  tags:    ['users'],
  query:   z.object({
    page:  z.string().optional(),
    limit: z.string().optional(),
    q:     z.string().optional(),
  }),
  response: { 200: z.array(UserSchema) },
}, (req, res) => {
  const { page = '1', limit = '10', q = '' } = req.query;
  res.json([]);
});
```

### Protected route with lock icon

```ts
router.delete('/users/:id', {
  summary:  'Delete a user',
  tags:     ['users'],
  security: [{ bearerAuth: [] }],
  params:   z.object({ id: z.string().uuid() }),
  response: {
    204: z.object({}),
    401: z.object({ error: z.string() }),
  },
}, authMiddleware, (req, res) => {
  res.sendStatus(204);
});
```

### Marking a route as deprecated

```ts
router.get('/v1/users', {
  summary:    'List users (deprecated)',
  tags:       ['users'],
  deprecated: true,
  response:   { 200: z.array(UserSchema) },
}, (req, res) => {
  res.json([]);
});
```

### Full setup with auth — complete example

```ts
import mimi, { json, authMiddleware } from 'mimi.js';
import { Router } from 'mimi.js';
import { z } from 'zod';

const TodoSchema = z.object({
  id:        z.number(),
  title:     z.string(),
  done:      z.boolean(),
});

const app = mimi({
  docs: {
    info:    { title: 'Todo API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
});

app.use(json());

const router = new Router();

// Public route — no lock icon
router.post('/auth/login', {
  summary: 'Log in',
  tags:    ['auth'],
  body:    z.object({ email: z.string(), password: z.string() }),
  response: { 200: z.object({ token: z.string() }) },
}, handler);

// Protected route — shows lock icon
router.get('/todos', {
  summary:  'List todos',
  tags:     ['todos'],
  security: [{ bearerAuth: [] }],
  response: { 200: z.array(TodoSchema) },
}, authMiddleware, handler);

app.listen(3000);
```

---

## Backward Compatibility

Routes defined **without** a schema object continue to work exactly as before — they simply don't appear in the generated spec.

```ts
// No schema — works fine, just not documented
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

`setupSwagger(app, options)` still works if you prefer it over `mimi({ docs })`.

The only thing removed is JSDoc `@openapi` comment parsing — that approach is no longer supported. Use Zod schemas instead.
