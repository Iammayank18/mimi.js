// Agent-native store — one definition per action, served to humans (REST) and AI agents (MCP).
// Run:  npm run build && node examples/agent-store/server.js
const { mimi, agent, json, cors } = require('../../dist');
const { z } = require('zod');

const port = Number(process.env.PORT) || 3000;
const app = mimi({ processErrorHandlers: false });
app.use(cors());
app.use(json());

// ── fake data ──────────────────────────────────────────────────────
const products = new Map([
  ['p_tee', { id: 'p_tee', name: 'Mimi T-shirt', price: 25, stock: 40 }],
  ['p_mug', { id: 'p_mug', name: 'Mimi mug', price: 12, stock: 3 }],
  ['p_hoodie', { id: 'p_hoodie', name: 'Mimi hoodie', price: 60, stock: 10 }],
]);
const orders = new Map();
const outbox = [];
let seq = 100;

// ── the agent layer ────────────────────────────────────────────────
const ai = agent(app, {
  name: 'Mimi Store',
  version: '1.0.0',
  description: 'A small merch store. Browse products, place orders, refund them, email customers.',
  instructions: 'Prices are in USD. Never refund more than the order total. Confirm refunds over $50 with the user.',
  budgets: { default: { requestsPerMinute: 120, spendPerDay: 200 } },
  onApprovalRequested: (a) =>
    console.log(`\n🔔 Approval needed: ${a.action} — ${a.reason}\n   approve: curl -X POST localhost:${port}/_agent/approvals/${a.id}/approve\n`),
});

ai.action('searchProducts', {
  description: 'Search the product catalog by name. Returns id, name, price and stock.',
  when: 'Use to find a product id before placing an order.',
  http: 'GET /products',
  input: z.object({ q: z.string().optional().describe('Words in the product name'), maxPrice: z.number().optional() }),
  examples: [{ input: { q: 'mug' } }],
  run: ({ q, maxPrice }) =>
    [...products.values()].filter(
      (p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (maxPrice === undefined || p.price <= maxPrice),
    ),
});

ai.action('placeOrder', {
  description: 'Place an order for one product and charge the customer card on file.',
  when: 'Use only after the user confirmed the product and quantity.',
  http: 'POST /orders',
  effect: 'spend',
  input: z.object({
    productId: z.string().describe('From searchProducts'),
    quantity: z.number().int().positive().max(10),
    email: z.string().email().describe('Customer email for the receipt'),
  }),
  examples: [{ input: { productId: 'p_tee', quantity: 2, email: 'sam@example.com' } }],
  cost: (i) => (products.get(i.productId)?.price ?? 0) * i.quantity,
  async run(input, ctx) {
    const p = products.get(input.productId);
    if (!p) ctx.fail('PRODUCT_NOT_FOUND', { status: 404, param: 'productId', fix: 'Call searchProducts to get a valid id.', suggest: [{ action: 'searchProducts' }] });
    if (p.stock < input.quantity) {
      ctx.fail('OUT_OF_STOCK', { status: 409, param: 'quantity', message: `Only ${p.stock} left.`, fix: `Order at most ${p.stock}, or pick another product.` });
    }
    const total = p.price * input.quantity;
    const id = await ctx.effect(`Charge $${total} and reserve ${input.quantity}× ${p.name}`, () => {
      const id = `ord_${++seq}`;
      p.stock -= input.quantity;
      orders.set(id, { id, ...input, total, refunded: 0, status: 'paid' });
      return id;
    }, 'ord_preview');
    return { orderId: id, total };
  },
  undo: async (input, out) => {
    const o = orders.get(out.orderId);
    products.get(input.productId).stock += input.quantity;
    o.status = 'cancelled';
  },
  next: (out) => [
    { action: 'getOrder', input: { orderId: out.orderId }, why: 'Check the order status' },
    { action: 'emailCustomer', input: { orderId: out.orderId }, why: 'Send a confirmation' },
  ],
});

ai.action('getOrder', {
  description: 'Get an order by id, including total, refunds and status.',
  http: 'GET /orders/:orderId',
  input: z.object({ orderId: z.string() }),
  run: ({ orderId }, ctx) => orders.get(orderId) ?? ctx.fail('ORDER_NOT_FOUND', { status: 404, fix: 'Check the id from placeOrder.' }),
});

ai.action('refundOrder', {
  description: 'Refund all or part of an order to the original card.',
  when: 'Use when the customer wants money back. Not for cancelling unpaid orders.',
  http: 'POST /orders/:orderId/refund',
  effect: 'spend',
  input: z.object({ orderId: z.string(), amount: z.number().positive(), reason: z.string().min(3) }),
  cost: (i) => i.amount,
  approval: (i) => i.amount > 50 && 'Refunds over $50 need a human.',
  async run(input, ctx) {
    const o = orders.get(input.orderId);
    if (!o) ctx.fail('ORDER_NOT_FOUND', { status: 404, suggest: [{ action: 'getOrder' }] });
    const left = o.total - o.refunded;
    if (input.amount > left) ctx.fail('REFUND_TOO_LARGE', { status: 409, param: 'amount', fix: `Refund at most ${left}.` });
    await ctx.effect(`Refund $${input.amount} for ${o.id} (${input.reason})`, () => {
      o.refunded += input.amount;
    });
    return { orderId: o.id, refunded: o.refunded, remaining: o.total - o.refunded };
  },
  undo: async (input) => {
    orders.get(input.orderId).refunded -= input.amount;
  },
});

ai.action('emailCustomer', {
  description: 'Email the customer of an order a short message (confirmation, apology, update).',
  http: 'POST /orders/:orderId/email',
  effect: 'external',
  input: z.object({ orderId: z.string(), message: z.string().max(500).default('Thanks for your order!') }),
  async run(input, ctx) {
    const o = orders.get(input.orderId) ?? ctx.fail('ORDER_NOT_FOUND', { status: 404 });
    await ctx.effect(`Send email to ${o.email}`, () => outbox.push({ to: o.email, body: input.message }));
    return { sent: true, to: o.email };
  },
});

ai.action('deleteCustomerData', {
  description: 'Permanently erase all data for a customer email (GDPR request).',
  effect: 'destructive',
  agents: 'deny',
  input: z.object({ email: z.string().email() }),
  run: ({ email }) => ({ erased: email }),
});

// A plain mimi route still works side by side.
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`Mimi Store on http://localhost:${port}`);
  console.log(`  MCP:        http://localhost:${port}/mcp`);
  console.log(`  Manifest:   http://localhost:${port}/.well-known/agent.json`);
  console.log(`  llms.txt:   http://localhost:${port}/llms.txt`);
  console.log(`  Insights:   http://localhost:${port}/_agent/insights`);
});
