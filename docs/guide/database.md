---
title: Database
outline: deep
---

# Database

mimi.js includes singleton manager wrappers for MongoDB (via Mongoose) and SQLite (via Sequelize). Both are **optional peer dependencies** — install only what you need.

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
