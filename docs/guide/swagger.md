---
title: Swagger / OpenAPI
outline: deep
---

# Swagger / OpenAPI

mimi.js includes built-in Swagger UI at `/api-docs`. Annotate your routes with JSDoc comments — the spec is generated automatically.

## Setup

```ts
import mimi, { setupSwagger } from 'mimi.js';

const app = mimi();

setupSwagger(app, {
  info: { title: 'My API', version: '1.0.0' },
  filesPattern: './routes/**/*.ts', // glob pointing at your route files
});
```

Visit `http://localhost:3000/api-docs` to see the interactive UI.
The raw OpenAPI JSON is available at `/api-docs/swagger.json`.

---

## Content Security Policy

Swagger UI loads its assets (JS, CSS, fonts) from `https://unpkg.com`. If you use the `security()` middleware, its default CSP (`default-src 'self'`) will block those assets.

Pass a permissive CSP string specifically for Swagger when calling `security()`:

```ts
import mimi, { security, setupSwagger } from 'mimi.js';

const app = mimi();

app.use(security({
  contentSecurityPolicy:
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "img-src 'self' data: https://unpkg.com; " +
    "font-src 'self' https://unpkg.com; " +
    "connect-src 'self'",
}));

setupSwagger(app, {
  info: { title: 'My API', version: '1.0.0' },
  filesPattern: './routes/**/*.ts',
});
```

If you're not using Swagger in production, you can conditionally disable `setupSwagger` and keep the strict default CSP.

---

## Documenting Routes

Use JSDoc `@` annotations above each route handler. The full syntax follows [express-jsdoc-swagger](https://brikev.github.io/express-jsdoc-swagger-docs/).

### GET with response

```typescript
/**
 * GET /users
 * @summary List all users
 * @description Returns a paginated list of all users.
 * @return {object[]} 200 - Array of user objects
 * @return {object} 500 - Server error
 */
app.get('/users', (_req, res) => {
  res.json([]);
});
```

### POST with request body

```typescript
/**
 * POST /users
 * @summary Create a user
 * @param {object} request.body.required - User data
 * @param {string} request.body.required.name - User's full name
 * @param {string} request.body.required.email - User's email address
 * @return {object} 201 - Created user
 * @return {object} 400 - Validation error
 */
app.post('/users', (req, res) => {
  res.status(201).json(req.body);
});
```

### Path parameters

```typescript
/**
 * GET /users/{id}
 * @summary Get user by ID
 * @param {string} id.path.required - User ID
 * @return {object} 200 - User object
 * @return {object} 404 - User not found
 */
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});
```

### With authentication

```typescript
/**
 * DELETE /users/{id}
 * @summary Delete a user
 * @param {string} id.path.required - User ID
 * @security BearerAuth
 * @return {object} 204 - User deleted
 * @return {object} 401 - Unauthorized
 * @return {object} 404 - User not found
 */
app.delete('/users/:id', authMiddleware, (req, res) => {
  res.sendStatus(204);
});
```

### With examples

```typescript
/**
 * POST /login
 * @summary User login
 * @param {object} request.body.required - Credentials
 * @param {string} request.body.required.email - Email
 * @param {string} request.body.required.password - Password
 * @return {object} 200 - Login successful
 * @return {object} 401 - Invalid credentials
 * @example request - Example payload
 * {
 *   "email": "user@example.com",
 *   "password": "secret123"
 * }
 * @example response - 200 - Token response
 * {
 *   "token": "eyJhbGciOiJIUzI1NiJ9..."
 * }
 */
app.post('/login', async (req, res) => {
  // ...
});
```

