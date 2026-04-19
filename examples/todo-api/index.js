/**
 * mimijs — Todo API example
 *
 * Demonstrates: routing, middleware (cors, json, security),
 * JWT auth, request logging, and Swagger docs.
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
  setupSwagger,
  generateToken,
  hashPassword,
  comparePassword,
  authMiddleware,
} = require('../../dist');

const app = mimi();

// ─── Global middleware ──────────────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(security());
app.use(json());

// Swagger UI loads CSS, JS, and fonts from unpkg CDN — relax CSP for those routes only
const swaggerCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "font-src 'self' data: https://unpkg.com https://r2cdn.perplexity.ai",
  "img-src 'self' data:",
  "connect-src 'self' https://unpkg.com",
  "worker-src blob:",
].join('; ');

app.use('/api-docs', security({ contentSecurityPolicy: swaggerCsp }));
app.use('/api-docs', (_req, res, next) => {
  res.removeHeader('X-Frame-Options'); // allow SwaggerUI iframe elements
  next();
});
app.use(urlencoded());
app.use(requestLogger);

// ─── In-memory store ───────────────────────────────────────────────────────

const users = [];
let todos = [];
let nextId = 1;

// ─── Auth routes ───────────────────────────────────────────────────────────

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:   { type: string, example: alice@example.com }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Missing fields or email taken }
 */
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hash = await hashPassword(password);
  const user = { id: users.length + 1, email, hash };
  users.push(user);

  const token = generateToken({ id: user.id, email: user.email });
  res.status(201).json({ token });
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: JWT token }
 *       401: { description: Invalid credentials }
 */
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);

  if (!user || !(await comparePassword(password, user.hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken({ id: user.id, email: user.email });
  res.json({ token });
});

// ─── Todo routes (protected) ────────────────────────────────────────────────

/**
 * @openapi
 * /todos:
 *   get:
 *     summary: List todos for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of todos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Todo'
 */
app.get('/todos', authMiddleware, (req, res) => {
  const userTodos = todos.filter((t) => t.userId === req.user.id);
  res.json(userTodos);
});

/**
 * @openapi
 * /todos:
 *   post:
 *     summary: Create a todo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, example: Buy groceries }
 *     responses:
 *       201: { description: Created todo }
 */
app.post('/todos', authMiddleware, (req, res) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }

  const todo = {
    id: nextId++,
    userId: req.user.id,
    title: title.trim(),
    done: false,
    createdAt: new Date().toISOString(),
  };
  todos.push(todo);
  res.status(201).json(todo);
});

/**
 * @openapi
 * /todos/{id}:
 *   patch:
 *     summary: Toggle a todo's done status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *         required: true
 *     responses:
 *       200: { description: Updated todo }
 *       404: { description: Not found }
 */
app.patch('/todos/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((t) => t.id === id && t.userId === req.user.id);

  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  todo.done = !todo.done;
  res.json(todo);
});

/**
 * @openapi
 * /todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: integer }
 *         required: true
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
app.delete('/todos/:id', authMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const idx = todos.findIndex((t) => t.id === id && t.userId === req.user.id);

  if (idx === -1) return res.status(404).json({ error: 'Todo not found' });

  todos.splice(idx, 1);
  res.json({ deleted: true });
});

// ─── Swagger docs ───────────────────────────────────────────────────────────

setupSwagger(app, {
  info: { title: 'Todo API', version: '1.0.0', description: 'A simple todo API built with mimijs' },
  filesPattern: './examples/todo-api/index.js',
});

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
