---
title: Database
nav_order: 6
---

# Database
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

mimi.js includes singleton manager wrappers for MongoDB (via Mongoose) and SQLite (via Sequelize). Both are **optional peer dependencies** — install only what you need.

---

## MongoDB

### Installation

```bash
npm install mongoose
```

### Basic Usage

```typescript
import mimi, { json, mongodbManager } from 'mimi.js';
import { Schema, model } from 'mongoose';

// Connect before starting the server
await mongodbManager.connect('mongodb://localhost:27017/myapp');

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const User = model('User', UserSchema);

const app = mimi();
app.use(json());

app.get('/users', async (_req, res) => {
  const users = await User.find().select('-__v');
  res.json(users);
});

app.post('/users', async (req, res) => {
  const { name, email } = req.body as { name: string; email: string };
  const user = await User.create({ name, email });
  res.status(201).json(user);
});

app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.listen(3000);
```

### `mongodbManager` API

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect` | `(uri: string, options?: object) => Promise<void>` | Connect to MongoDB |
| `disconnect` | `() => Promise<void>` | Close the connection |
| `connection` | `mongoose.Connection \| null` | The active Mongoose connection |

### Connection String Formats

```typescript
// Local
await mongodbManager.connect('mongodb://localhost:27017/mydb');

// MongoDB Atlas
await mongodbManager.connect(
  'mongodb+srv://user:pass@cluster.mongodb.net/mydb',
  { serverSelectionTimeoutMS: 5000 }
);

// With options
await mongodbManager.connect('mongodb://localhost:27017/mydb', {
  maxPoolSize: 10,
});
```

---

## SQLite

### Installation

```bash
npm install sequelize sqlite3
```

### Basic Usage

```typescript
import mimi, { json, SQLiteManager } from 'mimi.js';
import { DataTypes } from 'sequelize';

const db = new SQLiteManager('./data.sqlite');
await db.connect();

const Post = db.instance.define('Post', {
  title: { type: DataTypes.STRING, allowNull: false },
  body: { type: DataTypes.TEXT },
  published: { type: DataTypes.BOOLEAN, defaultValue: false },
});

await Post.sync({ alter: true });

const app = mimi();
app.use(json());

app.get('/posts', async (_req, res) => {
  const posts = await Post.findAll({ where: { published: true } });
  res.json(posts);
});

app.post('/posts', async (req, res) => {
  const post = await Post.create(req.body as any);
  res.status(201).json(post);
});

app.listen(3000);
```

### In-Memory Database (Testing)

```typescript
// No file written — data lives only in memory
const db = new SQLiteManager(':memory:');
await db.connect();
```

### `SQLiteManager` API

| Member | Type / Signature | Description |
|--------|-----------------|-------------|
| `new SQLiteManager(storagePath?)` | Constructor | Creates a Sequelize instance. Defaults to `':memory:'` |
| `connect()` | `() => Promise<void>` | Authenticate and verify the connection |
| `disconnect()` | `() => Promise<void>` | Close the connection |
| `instance` | `Sequelize` | The raw Sequelize instance for defining models |

---

## Using Both Databases

You can use both adapters in the same application:

```typescript
import mimi, { mongodbManager, SQLiteManager } from 'mimi.js';

// Connect both
await Promise.all([
  mongodbManager.connect('mongodb://localhost:27017/maindb'),
  new SQLiteManager('./cache.sqlite').connect(),
]);

const app = mimi();
app.listen(3000);
```

---

## Connection Error Handling

Both adapters throw errors on failed connections. Wrap in try/catch at startup:

```typescript
try {
  await mongodbManager.connect(process.env.MONGO_URI!);
  console.log('MongoDB connected');
} catch (err) {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
}
```
