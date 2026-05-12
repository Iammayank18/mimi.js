/**
 * mimijs — Todo API example
 *
 * Demonstrates: routing, middleware (cors, json, security),
 * JWT auth, request logging, Zod validation, and auto-generated Swagger docs.
 *
 * Run:  node examples/todo-api/index.js
 * Docs: http://localhost:3000/api-docs
 */

const {
  default: mimi,
  json,
  urlencoded,
  cors,
  security,
  requestLogger,
  generateToken,
  hashPassword,
  comparePassword,
  authMiddleware,
} = require('../../dist');

const { z } = require('zod');

// ─── Schemas ────────────────────────────────────────────────────────────────

const TodoSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  title: z.string().min(1),
  done: z.boolean(),
  createdAt: z.iso.datetime(),
});

const CreateTodoSchema = z.object({
  title: z.string().min(1),
});

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const TokenSchema = z.object({
  token: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

// ─── App (docs auto-configured, no CSP setup needed) ───────────────────────

const app = mimi({
  docs: {
    info: {
      title: 'Todo API',
      version: '1.0.0',
      description: 'A simple todo API built with mimijs',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
});

// ─── Global middleware ──────────────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(security());
app.use(json());
app.use(urlencoded());
app.use(requestLogger);

// ─── In-memory store ───────────────────────────────────────────────────────

const users = [];
let todos = [];
let nextId = 1;

// ─── Auth routes ───────────────────────────────────────────────────────────

app.post(
  '/auth/register',
  {
    summary: 'Register a new user',
    tags: ['auth'],
    body: LoginSchema,
    response: { 201: TokenSchema, 400: ErrorSchema },
  },
  async (req, res) => {
    const { email, password } = req.body;

    if (users.find((u) => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hash = await hashPassword(password);
    const user = { id: users.length + 1, email, hash };
    users.push(user);

    const token = generateToken({ id: user.id, email: user.email });
    res.status(201).json({ token });
  },
);

app.post(
  '/auth/login',
  {
    summary: 'Log in and receive a JWT',
    tags: ['auth'],
    body: LoginSchema,
    response: { 200: TokenSchema, 401: ErrorSchema },
  },
  async (req, res) => {
    const { email, password } = req.body;
    const user = users.find((u) => u.email === email);

    if (!user || !(await comparePassword(password, user.hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, email: user.email });
    res.json({ token });
  },
);

// ─── Todo routes (protected) ────────────────────────────────────────────────

app.get(
  '/todos',
  {
    summary: 'List todos for the authenticated user',
    tags: ['todos'],
    security: [{ bearerAuth: [] }],
    response: { 200: z.array(TodoSchema) },
  },
  authMiddleware,
  (req, res) => {
    const userTodos = todos.filter((t) => t.userId === req.user.id);
    res.json(userTodos);
  },
);

app.post(
  '/todos',
  {
    summary: 'Create a todo',
    tags: ['todos'],
    security: [{ bearerAuth: [] }],
    body: CreateTodoSchema,
    response: { 201: TodoSchema, 422: z.object({ error: z.string(), issues: z.array(z.any()) }) },
  },
  authMiddleware,
  (req, res) => {
    const todo = {
      id: nextId++,
      userId: req.user.id,
      title: req.body.title.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    todos.push(todo);
    res.status(201).json(todo);
  },
);

app.patch(
  '/todos/:id',
  {
    summary: "Toggle a todo's done status",
    tags: ['todos'],
    security: [{ bearerAuth: [] }],
    params: z.object({ id: z.string() }),
    response: { 200: TodoSchema, 404: ErrorSchema },
  },
  authMiddleware,
  (req, res) => {
    const id = Number(req.params.id);
    const todo = todos.find((t) => t.id === id && t.userId === req.user.id);

    if (!todo) return res.status(404).json({ error: 'Todo not found' });

    todo.done = !todo.done;
    res.json(todo);
  },
);

app.delete(
  '/todos/:id',
  {
    summary: 'Delete a todo',
    tags: ['todos'],
    security: [{ bearerAuth: [] }],
    params: z.object({ id: z.string() }),
    response: { 200: z.object({ deleted: z.boolean() }), 404: ErrorSchema },
  },
  authMiddleware,
  (req, res) => {
    const id = Number(req.params.id);
    const idx = todos.findIndex((t) => t.id === id && t.userId === req.user.id);

    if (idx === -1) return res.status(404).json({ error: 'Todo not found' });

    todos.splice(idx, 1);
    res.json({ deleted: true });
  },
);

// ─── Health check ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── Global error handler ───────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal Server Error' });
});

// ─── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000;
app.listen(Number(PORT), () => {
  console.log(`Todo API running at http://localhost:${PORT}`);
  console.log(`Swagger docs:      http://localhost:${PORT}/api-docs`);
});
