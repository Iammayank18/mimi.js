---
title: Swagger / OpenAPI
outline: deep
---

# Swagger / OpenAPI

mimi.js includes built-in Swagger UI at `/api-docs`. Annotate your routes with JSDoc comments — the spec is generated automatically.

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

