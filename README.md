<div align="center">
<img src="https://github.com/user-attachments/assets/6bb183ae-7ec1-4da9-95f2-85064f4deda0" alt="mimi.js Logo" width="100" height="100">
  <h1>mimi.js</h1>
</div>

# mimi.js

A lightweight and easy-to-use JavaScript library for creating node.js applications with integrated parsers, automatic Swagger documentation and much more.

## Installation

Install the package via npm:

```bash
npm install mimi.js
```

## Usage

### Basic Setup

```javascript
// Import the library
import mimi from 'mimi.js';

// Create an app instance
const app = mimi();

app.get('/hello', (req, res) => {
  res.send('Hello, world!');
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

### Using Built-in Authentication

```typescript
import mimi, { hashPassword, comparePassword, generateToken, authMiddleware } from 'mimi.js';

const app = mimi();

// Example user data
const users = [{ id: 1, email: 'user@example.com', password: await hashPassword('password123') }];

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  if (user && (await comparePassword(password, user.password))) {
    const token = generateToken(user);
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Protected route
app.get('/protected', authMiddleware, (req, res) => {
  res.send(`Hello, ${req.user.email}`);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

### Automatic Swagger Documentation

mimi.js integrates Swagger documentation automatically based on your defined routes. docs can be shown on http://localhost:3000/api-docs

```javascript
// Import the library
import mimi, { Router, Route, setupSwagger, generateToken, comparePassword } from 'mimi.js';

// Create an app instance
const app = mimi();

// Setup Swagger
setupSwagger(app, {
  info: {
    title: 'My API',
    version: '1.0.0',
    description: 'My API Documentation',
  },
});

/**
 * POST /login
 * @summary User Login
 * @description This endpoint allows a user to login by providing their username and password.
 * @param {object} request.body.required - User credentials
 * @param {object} request.body.required.username - Username of the user
 * @param {object} request.body.required.password - Password of the user
 * @return {object} 200 - User successfully logged in
 * @return {object} 401 - Invalid username or password
 * @example request - Example payload
 * {
 *   "username": "user",
 *   "password": "pass"
 * }
 * @example response - 200 - success response example
 * {
 *   "message": "User successfully logged in",
 *   "token": "fake-jwt-token"
 * }
 * @example response - 401 - error response example
 * {
 *   "message": "Invalid username or password"
 * }
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  if (user && (await comparePassword(password, user.password))) {
    const token = generateToken(user);
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.use(router);

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

### Custom Parsers

You can add custom parsers to handle specific content types:

```typescript
import mimi, { customParser } from 'mimi.js';

const app = mimi();
app.use(customParser);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

## API Reference

### `mimi()`

Creates an Express-like application.

### `setupSwagger(app, options)`

Sets up Swagger documentation for the given app.

### `Router()`

Creates a new router instance.

### `Route`

Defines a new route.

### `authMiddleware`

Middleware to protect routes with JWT authentication.

### `generateToken(user)`

Generates a JWT for the given user.

### `hashPassword(password)`

Hashes a password using bcrypt.

### `comparePassword(password, hash)`

Compares a password with a hashed password using bcrypt.

## Coming Soon

We are actively working on adding more features to mimi.js. Here's a sneak peek at what's coming next:

- **Database Setup:** Easy integration with popular databases like MongoDB, PostgreSQL, and MySQL.
- **Payment Setup:** Built-in support for payment gateways like Stripe, PayPal and more.
- **AWS Setup:** Seamless integration with AWS services including S3, Lambda, and DynamoDB.

Stay tuned for updates!

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
