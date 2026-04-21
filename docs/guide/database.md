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

`mongodbManager` is a pre-created singleton. Call `connect()` once at startup:

```ts
import mimi, { json } from 'mimi.js';
import { mongodbManager } from 'mimi.js';

const app = mimi();
app.use(json());

await mongodbManager.connect(process.env.MONGO_URI!);
console.log('MongoDB connected');

app.listen(3000);
```

### Define a Collection (Model)

`createCollection(name, schema)` creates a Mongoose model with `createdAt`/`updatedAt` timestamps:

```ts
import { mongodbManager } from 'mimi.js';

const User = mongodbManager.createCollection('User', {
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role:  { type: String, enum: ['user', 'admin'], default: 'user' },
}) as any;
```

### CRUD Example

```ts
import mimi, { json } from 'mimi.js';
import { mongodbManager } from 'mimi.js';

await mongodbManager.connect(process.env.MONGO_URI!);

const User = mongodbManager.createCollection('User', {
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
}) as any;

const app = mimi();
app.use(json());

app.get('/users', async (req, res) => {
  res.json(await User.find());
});

app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  res.json(user);
});

app.post('/users', async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json(user);
});

app.put('/users/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  res.json(user);
});

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

```ts
import { SQLiteManager } from 'mimi.js';

const db = new SQLiteManager('./data.sqlite');
await db.connect();
console.log('SQLite connected');
```

### Define a Model

Use `db.sequelize` (the raw Sequelize instance) to define models:

```ts
import { SQLiteManager } from 'mimi.js';
import { DataTypes } from 'sequelize';

const db = new SQLiteManager('./data.sqlite');
await db.connect();

const Post = db.sequelize.define('Post', {
  title:     { type: DataTypes.STRING, allowNull: false },
  body:      { type: DataTypes.TEXT },
  published: { type: DataTypes.BOOLEAN, defaultValue: false },
});

await Post.sync({ alter: true }); // creates table if missing
```

### CRUD Example

```ts
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

app.get('/posts', async (req, res) => {
  res.json(await Post.findAll({ where: { published: true } }));
});

app.get('/posts/:id', async (req, res) => {
  const post = await Post.findByPk(req.params.id);
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  res.json(post);
});

app.post('/posts', async (req, res) => {
  const post = await Post.create(req.body as any);
  res.status(201).json(post);
});

app.put('/posts/:id', async (req, res) => {
  const [count] = await Post.update(req.body as any, { where: { id: req.params.id } });
  if (count === 0) throw Object.assign(new Error('Post not found'), { status: 404 });
  res.json({ updated: true });
});

app.delete('/posts/:id', async (req, res) => {
  await Post.destroy({ where: { id: req.params.id } });
  res.sendStatus(204);
});

app.listen(3000);
```

### In-Memory Database (Testing)

Omit the file path or pass `':memory:'` for a temporary database — nothing written to disk:

```ts
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

Fail fast at startup if the database is unreachable:

```ts
try {
  await mongodbManager.connect(process.env.MONGO_URI!);
  console.log('MongoDB connected');
} catch (err) {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
}
```

---

## Using a Plugin for DB Setup

Clean pattern for production apps — put the connection inside a plugin so routes only register after the DB is ready:

```ts
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
