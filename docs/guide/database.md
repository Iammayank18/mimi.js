---
title: Database
outline: deep
---

# Database

mimi.js includes singleton manager wrappers for **MongoDB** (via Mongoose) and **SQLite** (via Sequelize). Both are optional peer dependencies — install only what you use.

---

## MongoDB

### Installation

```bash
npm install mongoose
```

### Connect

`mongodbManager` is a pre-created singleton. Call `connect()` once at app startup:

```typescript
import mimi, { json } from 'mimi.js';
import { mongodbManager } from 'mimi.js';

const app = mimi();
app.use(json());

// Connect before starting the server
await mongodbManager.connect(process.env.MONGO_URI!);
console.log('MongoDB connected');

app.listen(3000);
```

### Define a Collection (Model)

`createCollection(name, schemaDefinition)` creates a Mongoose model. All models get `createdAt` / `updatedAt` timestamps automatically:

```typescript
import { mongodbManager } from 'mimi.js';

// Define the collection
const User = mongodbManager.createCollection('User', {
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role:  { type: String, enum: ['user', 'admin'], default: 'user' },
}) as any; // cast to mongoose.Model for full type support
```

### CRUD Example

```typescript
import mimi, { json } from 'mimi.js';
import { mongodbManager } from 'mimi.js';

await mongodbManager.connect(process.env.MONGO_URI!);

const User = mongodbManager.createCollection('User', {
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
}) as any;

const app = mimi();
app.use(json());

// List all users
app.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Get single user
app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  res.json(user);
});

// Create user
app.post('/users', async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(user);
});

// Update user
app.put('/users/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  res.json(user);
});

// Delete user
app.delete('/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

app.listen(3000);
```

### `mongodbManager` API

| Member | Signature | Description |
|---|---|---|
| `connect(uri, options?)` | `(string, object?) => Promise<string>` | Connect to MongoDB. Returns a status message |
| `createCollection(name, schema)` | `(string, object) => mongoose.Model` | Define a model with auto-timestamps |

---

## SQLite

### Installation

```bash
npm install sequelize sqlite3
```

### Connect

```typescript
import { SQLiteManager } from 'mimi.js';

const db = new SQLiteManager('./data.sqlite');
await db.connect();
console.log('SQLite connected');
```

### Define a Model

Use `db.sequelize` (the raw Sequelize instance) to define models:

```typescript
import { SQLiteManager } from 'mimi.js';
import { DataTypes } from 'sequelize';

const db = new SQLiteManager('./data.sqlite');
await db.connect();

const Post = db.sequelize.define('Post', {
  title:     { type: DataTypes.STRING, allowNull: false },
  body:      { type: DataTypes.TEXT },
  published: { type: DataTypes.BOOLEAN, defaultValue: false },
});

// Sync model to DB (creates table if missing)
await Post.sync({ alter: true });
```

### CRUD Example

```typescript
import mimi, { json } from 'mimi.js';
import { SQLiteManager } from 'mimi.js';
import { DataTypes } from 'sequelize';

const db = new SQLiteManager('./blog.sqlite');
await db.connect();

const Post = db.sequelize.define('Post', {
  title:     { type: DataTypes.STRING, allowNull: false },
  body:      { type: DataTypes.TEXT },
  published: { type: DataTypes.BOOLEAN, defaultValue: false },
});
await Post.sync({ alter: true });

const app = mimi();
app.use(json());

// List published posts
app.get('/posts', async (req, res) => {
  const posts = await Post.findAll({ where: { published: true } });
  res.json(posts);
});

// Get single post
app.get('/posts/:id', async (req, res) => {
  const post = await Post.findByPk(req.params.id);
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  res.json(post);
});

// Create post
app.post('/posts', async (req, res) => {
  const post = await Post.create(req.body as any);
  res.status(201).json(post);
});

// Update post
app.put('/posts/:id', async (req, res) => {
  const [count] = await Post.update(req.body as any, {
    where: { id: req.params.id },
  });
  if (count === 0) throw Object.assign(new Error('Post not found'), { status: 404 });
  res.json({ updated: true });
});

// Delete post
app.delete('/posts/:id', async (req, res) => {
  await Post.destroy({ where: { id: req.params.id } });
  res.sendStatus(204);
});

app.listen(3000);
```

### In-Memory Database (Testing)

Omit the file path (or pass `':memory:'`) for a temporary in-memory database — nothing is written to disk:

```typescript
const db = new SQLiteManager(); // defaults to ':memory:'
await db.connect();
```

### `SQLiteManager` API

| Member | Signature | Description |
|---|---|---|
| `new SQLiteManager(path?)` | `(string) => SQLiteManager` | Creates Sequelize instance. Default: `':memory:'` |
| `connect()` | `() => Promise<string>` | Authenticate and verify the connection |
| `sequelize` | `Sequelize` | The raw Sequelize instance for defining models |

---

## Connection Error Handling

Wrap the connection call in a try/catch at startup — fail fast if the DB is unreachable:

```typescript
try {
  await mongodbManager.connect(process.env.MONGO_URI!);
  console.log('MongoDB connected');
} catch (err) {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
}
```

```typescript
try {
  const db = new SQLiteManager('./data.sqlite');
  await db.connect();
  console.log('SQLite connected');
} catch (err) {
  console.error('SQLite connection failed:', err);
  process.exit(1);
}
```

---

## Using a Plugin for DB Setup

A clean pattern for production apps — put the database connection inside a plugin so the app waits for it before serving requests:

```typescript
import type { Plugin } from 'mimi.js';
import { mongodbManager } from 'mimi.js';

const dbPlugin: Plugin = async (app, options) => {
  await mongodbManager.connect(options.uri as string);
  console.log('Database connected');
};

const app = mimi();
await app.register(dbPlugin, { uri: process.env.MONGO_URI! });

app.listen(3000);
```

See [Plugins](/guide/plugins) for more patterns.
