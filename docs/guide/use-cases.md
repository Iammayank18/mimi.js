---
title: Use Cases
description: Real-world things you can build with mimi.js agent-native actions — with complete example code.
---

# Use Cases

Eight things teams build with mimi.js, each with code you can copy. Every example uses the same building block: an **action**, defined once and served to your apps (REST) and to AI agents (MCP), with the safety contract built in.

<UseCaseGrid />

::: tip Before you start
Examples that don't create their own `ai` assume this setup. Install with `npm install mimi.js zod`.

```ts
import mimi, { agent, json } from 'mimi.js';
import { z } from 'zod';

const app = mimi();
app.use(json());
const ai = agent(app, { name: 'Acme', adminKey: process.env.ADMIN_KEY });
// ... actions from the examples below ...
app.listen(3000); // REST on :3000, MCP at /mcp
```
:::

## AI customer support {#ai-customer-support}

<UseCaseHeader id="ai-customer-support" />

**The situation.** You want a support bot (built on Claude or GPT) to fix order problems on its own. You also don't want it refunding $2,000 because a customer asked nicely, or a prompt injection telling it to.

**The plan.** Let it look up orders freely, refund small amounts on its own, and send anything over $50 to a human. Every refund is undoable, and card numbers never reach the model.

```ts
import { agent, redact } from 'mimi.js';

const ai = agent(app, {
  name: 'Acme Support',
  plugins: [redact({ fields: ['cardNumber', 'email', 'phone'] })], // the model never sees PII
  // Ping the team when a refund needs a human
  onApprovalRequested: (a) =>
    slack.post('#support-leads', `Approval needed: ${a.reason}\n${a.plan.effects.map((e) => e.label).join('\n')}`),
});

ai.action('getOrder', {
  description: 'Look up an order by id: items, total, status and refunds so far.',
  when: 'Use first, before any refund, to check what the customer actually paid.',
  http: 'GET /orders/:orderId',
  input: z.object({ orderId: z.string() }),
  run: async ({ orderId }, ctx) =>
    (await db.orders.find(orderId)) ??
    ctx.fail('ORDER_NOT_FOUND', { status: 404, fix: 'Ask the customer for the order id from their receipt email.' }),
});

ai.action('refundOrder', {
  description: 'Refund part or all of an order to the original payment method.',
  when: 'Customer reports a damaged, missing or wrong item. Not for change-of-mind after 30 days.',
  http: 'POST /orders/:orderId/refund',
  effect: 'spend',
  input: z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    reason: z.enum(['damaged', 'missing', 'wrong_item', 'late', 'other']),
  }),
  examples: [{ input: { orderId: 'ord_123', amount: 19.99, reason: 'damaged' } }],
  cost: (i) => i.amount,
  approval: (i) => i.amount > 50 && `Refunds over $50 need a team lead (this one is $${i.amount}).`,

  async run(input, ctx) {
    const order = await db.orders.find(input.orderId);
    if (!order) ctx.fail('ORDER_NOT_FOUND', { status: 404, suggest: [{ action: 'getOrder' }] });
    const left = order.total - order.refunded;
    if (input.amount > left) {
      ctx.fail('REFUND_TOO_LARGE', { status: 409, param: 'amount', fix: `At most ${left} can still be refunded.` });
    }
    const refund = await ctx.effect(
      `Refund $${input.amount} to card •••${order.last4} (${input.reason})`,
      () => stripe.refunds.create({ payment_intent: order.paymentId, amount: input.amount * 100 }),
      { id: 're_preview' },
    );
    return { refundId: refund.id, remaining: left - input.amount };
  },

  undo: async (input, output) => stripe.refunds.cancel(output.refundId),
  next: (out, input) => [{ action: 'emailCustomer', input: { orderId: input.orderId }, why: 'Confirm the refund' }],
});
```

<FlowSteps :steps="[
  ['agent', 'Customer: “my mug arrived broken” → agent calls getOrder'],
  ['mimi', 'Returns the order with card number and email redacted'],
  ['agent', 'refundOrder { amount: 12, reason: damaged }'],
  ['ok', 'Refunded straight away, with a receipt and a next step: emailCustomer'],
  ['agent', 'Another customer wants $180 back → refundOrder { amount: 180 }'],
  ['wait', '202 approval_required: the exact plan is posted to #support-leads'],
  ['human', 'A team lead approves in one click → mimi runs that exact refund'],
]" />

::: info Why this matters
The bot handles most tickets end to end. Your exposure is capped at $50 per decision without a human, and every action has a receipt you can reverse.
:::

## AI shopping assistant {#ai-shopping-assistant}

<UseCaseHeader id="ai-shopping-assistant" />

**The situation.** Shoppers ask ChatGPT or Claude to buy things. Agents often retry when a response is slow, and they sometimes buy the wrong quantity. You need the agent to show the total before it charges, never charge twice, and stay within a daily budget.

```ts
const ai = agent(app, {
  name: 'Mimi Merch',
  budgets: { default: { requestsPerMinute: 60, spendPerDay: 300 } }, // per agent
});

ai.action('searchProducts', {
  description: 'Search the catalog by keyword. Returns id, name, price, stock and image.',
  when: 'Use to find a product id. Filter by maxPrice when the user gives a budget.',
  http: 'GET /products',
  input: z.object({ q: z.string(), maxPrice: z.number().optional() }),
  run: ({ q, maxPrice }) => db.products.search(q, { maxPrice }),
});

ai.action('checkout', {
  description: 'Buy products with the shopper’s saved card and ship to their default address.',
  when: 'Only after the user confirmed the items and the total from a dry run.',
  http: 'POST /checkout',
  effect: 'spend',
  input: z.object({
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(10) })).min(1),
    couponCode: z.string().optional(),
  }),
  cost: (i) => estimateTotal(i.items),

  async run(input, ctx) {
    const quote = await pricing.quote(input.items, input.couponCode); // reads run in dry-run too
    for (const line of quote.lines) {
      if (line.stock < line.quantity) {
        ctx.fail('OUT_OF_STOCK', { status: 409, fix: `Only ${line.stock} × ${line.name} left. Reduce quantity or pick another item.` });
      }
    }
    const order = await ctx.effect(
      `Charge $${quote.total} (${quote.lines.length} items, ${quote.discount ? `-$${quote.discount} coupon` : 'no coupon'})`,
      () => orders.create(ctx.caller.id, quote),
      { id: 'ord_preview' },
    );
    return { orderId: order.id, total: quote.total, eta: quote.eta };
  },
  undo: (_input, out) => orders.cancel(out.orderId),
});
```

::: code-group
```json [1. Dry run (MCP)]
// tools/call checkout { items: [...], _dryRun: true }
{
  "dryRun": true,
  "plan": {
    "effects": [{ "label": "Charge $74.00 (2 items, -$6 coupon)", "executed": false }],
    "cost": 74,
    "approvalRequired": false,
    "wouldReturn": { "orderId": "ord_preview", "total": 74, "eta": "Thu" }
  }
}
```
```json [2. Real call]
// tools/call checkout { items: [...], _idempotencyKey: "cart-8f2a" }
{
  "data": { "orderId": "ord_9182", "total": 74, "eta": "Thu" },
  "receipt": { "id": "rcpt_51c…", "undoable": true },
  "next": []
}
```
```json [3. Retry after timeout]
// same call, same _idempotencyKey
{ "data": { "orderId": "ord_9182", "total": 74 }, "replayed": "idempotency-key" }
// → card charged once
```
:::

<FlowSteps :steps="[
  ['agent', 'searchProducts { q: “hoodie”, maxPrice: 70 }'],
  ['agent', 'checkout with _dryRun → shows the user “$74, arrives Thursday”'],
  ['agent', 'User says yes → checkout with an idempotency key'],
  ['ok', 'Order placed; a timeout retry returns the same order'],
  ['stop', 'A runaway agent hits $300/day → its next purchase becomes an approval request'],
]" />

## DevOps & on-call agent {#devops-agent}

<UseCaseHeader id="devops-agent" />

**The situation.** An on-call agent restarts services and scales pods at 3am. Deploying to production should show a plan and need a human, and a bad deploy should be one undo away.

```ts
import { scopes, approvalRule } from 'mimi.js';

ai.use(scopes({
  'oncall-bot': ['getServiceHealth', 'restartService', 'scaleService', 'deploy'],
  'readonly-bot': ['getServiceHealth'],
}));

// Company rule: nobody's agent touches prod outside business hours without a human
ai.use(approvalRule('prod-hours', ({ input, caller }) => {
  const h = new Date().getUTCHours();
  return caller.kind === 'agent' && (input as any).env === 'production' && (h < 4 || h > 16)
    && 'Production changes outside 09:30–22:30 IST need on-call approval.';
}));

ai.action('deploy', {
  description: 'Deploy a git ref of a service to an environment.',
  when: 'Use for releases and hotfixes. For a quick fix of a crash loop, prefer restartService.',
  effect: 'write',
  input: z.object({
    service: z.enum(['api', 'web', 'worker']),
    ref: z.string().describe('Git SHA or tag'),
    env: z.enum(['staging', 'production']),
  }),
  approval: (i) => i.env === 'production' && 'Production deploys need a human.',

  async run({ service, ref, env }, ctx) {
    const current = await k8s.currentRef(service, env);
    const diff = await git.compare(current, ref); // read — runs in dry-run too
    if (diff.migrations.length) {
      ctx.fail('HAS_MIGRATIONS', { status: 409, fix: 'Run migrations with runMigrations first, then deploy.', suggest: [{ action: 'runMigrations', input: { service, env } }] });
    }
    await ctx.effect(`Roll ${service}@${env} from ${current.slice(0, 7)} → ${ref.slice(0, 7)} (${diff.commits} commits)`,
      () => k8s.rollout(service, env, ref));
    return { service, env, from: current, to: ref };
  },

  undo: (_i, out) => k8s.rollout(out.service, out.env, out.from), // rollback = undo
});
```

<FlowSteps :steps="[
  ['agent', 'Alert: api error rate 12% → deploy { ref: hotfix-a1b2, env: production, _dryRun: true }'],
  ['mimi', 'Plan: Roll api@production a9f3e21 → a1b2c3d (3 commits)'],
  ['wait', 'Real call → approval_required (production)'],
  ['human', 'On-call engineer reads the plan and approves from Slack'],
  ['ok', 'Deployed. Error rate still high → agent calls undo_action → rolled back'],
]" />

## Payouts & finance ops {#fintech-payouts}

<UseCaseHeader id="fintech-payouts" />

**The situation.** A finance agent pays vendor invoices. Finance needs hard limits per agent, a permanent audit trail, and certain actions that only people can do.

```ts
import { auditLog, requireUndo } from 'mimi.js';

const ai = agent(app, {
  name: 'Payouts',
  identify: async (req) => {                       // API key → agent identity
    const key = await apiKeys.verify(req.headers.authorization);
    return key && { kind: 'agent', id: key.agentId, name: key.label, verified: true };
  },
  budgets: {
    default: { requestsPerMinute: 30, spendPerDay: 5_000 },
    perAgent: { 'ap-agent-prod': { spendPerDay: 50_000 } },
  },
  plugins: [
    requireUndo({ effects: ['spend'] }),             // every money movement must be reversible
    auditLog((e) => warehouse.insert('agent_audit', e)), // every call, approval and undo, forever
  ],
});

ai.action('payInvoice', {
  description: 'Pay an approved vendor invoice by bank transfer.',
  effect: 'spend',
  input: z.object({ invoiceId: z.string(), amount: z.number().positive() }),
  cost: (i) => i.amount, // counts against the agent's spendPerDay
  async run({ invoiceId, amount }, ctx) {
    const inv = await invoices.get(invoiceId);
    if (inv.status !== 'approved') ctx.fail('INVOICE_NOT_APPROVED', { status: 409, fix: 'Only invoices in status "approved" can be paid.' });
    if (inv.amount !== amount) ctx.fail('AMOUNT_MISMATCH', { status: 409, param: 'amount', fix: `The invoice amount is ${inv.amount}.` });
    const transfer = await ctx.effect(`Send ${inv.currency} ${inv.amount} to ${inv.vendor} (${inv.iban.slice(-4)})`,
      () => bank.transfer(inv), { id: 'tr_preview' });
    return { transferId: transfer.id, amount: inv.amount };
  },
  undo: (_i, out) => bank.recall(out.transferId),
});

ai.action('closeVendorAccount', {
  description: 'Close a vendor account and stop all future payments.',
  effect: 'destructive',
  agents: 'deny', // humans only. Agents get AGENTS_NOT_ALLOWED with a clear message
  input: z.object({ vendorId: z.string() }),
  run: ({ vendorId }) => vendors.close(vendorId),
});
```

::: warning Tip
`cost` must be a number (or a sync function of the input) so per-agent `spendPerDay` limits work. That's why the amount is part of the input and checked against the invoice inside `run`.
:::

## Your SaaS inside ChatGPT & Claude {#saas-in-chatgpt}

<UseCaseHeader id="saas-in-chatgpt" />

**The situation.** You run a project-management SaaS. Customers want to say "move all my overdue tasks to next sprint" in ChatGPT. You have 60 endpoints, and agents get worse at picking tools once they see more than about 30.

```ts
const ai = agent(app, {
  name: 'TaskFlow',
  description: 'Projects, tasks, sprints and comments for software teams.',
  instructions: 'Dates are in the workspace timezone. Never assign tasks to people outside the workspace.',
  maxTools: 24, // above this, MCP exposes find_actions / describe_action / run_action
  identify: async (req) => {
    const t = await oauth.verify(req.headers.authorization); // token from the MCP client
    return t && { kind: 'agent', id: `ws_${t.workspaceId}:${t.clientId}`, name: t.clientName, verified: true };
  },
});

ai.action('moveTasks', {
  description: 'Move several tasks to another sprint or status in one call.',
  when: 'Bulk changes such as “move overdue tasks to next sprint”. For one task use updateTask.',
  effect: 'write',
  input: z.object({
    taskIds: z.array(z.string()).min(1).max(200),
    sprintId: z.string().optional(),
    status: z.enum(['todo', 'doing', 'done']).optional(),
  }),
  approval: (i) => i.taskIds.length > 50 && 'Moving more than 50 tasks needs confirmation.',
  async run(input, ctx) {
    const tasks = await db.tasks.many(input.taskIds);
    await ctx.effect(`Move ${tasks.length} tasks${input.sprintId ? ` to sprint ${input.sprintId}` : ''}`,
      () => db.tasks.bulkUpdate(input));
    return { moved: tasks.length, previous: tasks.map((t) => ({ id: t.id, sprintId: t.sprintId, status: t.status })) };
  },
  undo: (_i, out) => db.tasks.restore(out.previous),
});

// ...58 more actions
```

**Connect it.** Customers add `https://api.taskflow.app/mcp` as a connector in ChatGPT (Developer mode → Create app) or Claude (Settings → Connectors).

<FlowSteps :steps="[
  ['agent', 'find_actions { intent: “move overdue tasks to next sprint” }'],
  ['mimi', 'Top match: moveTasks (score 5.2), then listTasks'],
  ['agent', 'describe_action moveTasks → gets the schema and examples'],
  ['agent', 'run_action listTasks { overdue: true }, then run_action moveTasks { … }'],
  ['ok', 'Moved 14 tasks, undoable with one call if the user changes their mind'],
]" />

## Clinics, HR & sensitive data {#sensitive-data}

<UseCaseHeader id="sensitive-data" />

**The situation.** A clinic wants an assistant that books and reschedules appointments. The model must never see patient medical data, deleting records must stay with staff, and compliance wants a log of everything.

```ts
import { redact, requireUndo, auditLog, scopes } from 'mimi.js';

const ai = agent(app, {
  plugins: [
    redact({ fields: ['dob', 'diagnosis', 'insuranceId', 'notes', 'phone'] }),
    requireUndo(),
    scopes({ 'reception-assistant': ['findSlots', 'bookAppointment', 'reschedule', 'cancelAppointment'] },
           { defaultScope: [] }), // unknown agents can call nothing
    auditLog((e) => complianceLog.write(e)),
  ],
});

ai.action('bookAppointment', {
  description: 'Book an appointment for an existing patient in a free slot.',
  effect: 'write',
  input: z.object({ patientId: z.string(), slotId: z.string(), reason: z.string().max(120) }),
  async run(input, ctx) {
    const slot = await slots.get(input.slotId);
    if (!slot.free) ctx.fail('SLOT_TAKEN', { status: 409, fix: 'Call findSlots again and pick another time.', retriable: false });
    const appt = await ctx.effect(`Book ${slot.doctor} on ${slot.start}`, () => appointments.create(input), { id: 'appt_preview' });
    return { appointmentId: appt.id, when: slot.start, doctor: slot.doctor };
  },
  undo: (_i, out) => appointments.cancel(out.appointmentId),
});

ai.action('deletePatientRecord', {
  description: 'Permanently delete a patient record (data-erasure request).',
  effect: 'destructive',
  agents: 'deny',
  input: z.object({ patientId: z.string() }),
  run: ({ patientId }) => patients.erase(patientId),
});
```

## Marketing & outreach agent {#marketing-agent}

<UseCaseHeader id="marketing-agent" />

**The situation.** A growth agent sends campaigns. The worst outcomes are emailing the wrong segment, or sending the same blast twice because the first call timed out.

```ts
ai.action('sendCampaign', {
  description: 'Send an email campaign to a saved audience segment.',
  when: 'Use after the user approved subject, body and segment. Always dry-run first to see the recipient count.',
  effect: 'external',
  input: z.object({ segmentId: z.string(), subject: z.string().max(90), html: z.string(), sendAt: z.string().datetime().optional() }),
  approval: async (i) => {
    const n = await segments.count(i.segmentId);
    return n > 1000 && `This goes to ${n.toLocaleString()} people.`;
  },
  async run(input, ctx) {
    const audience = await segments.resolve(input.segmentId);            // read
    const unsub = audience.filter((r) => r.unsubscribed).length;
    const job = await ctx.effect(
      `Email “${input.subject}” to ${audience.length - unsub} people (${unsub} unsubscribed skipped)`,
      () => mailer.schedule(input, audience),
      { id: 'job_preview' },
    );
    return { jobId: job.id, recipients: audience.length - unsub };
  },
  undo: (_i, out) => mailer.cancel(out.jobId), // works until the job starts
});
```

<FlowSteps :steps="[
  ['agent', 'sendCampaign { segmentId: “trial-ending”, …, _dryRun: true }'],
  ['mimi', 'Plan: Email “Your trial ends Friday” to 842 people (31 unsubscribed skipped)'],
  ['agent', 'User confirms → real call'],
  ['ok', 'Scheduled. The agent times out and retries → auto-dedupe replays the job; no second blast'],
]" />

## Slack bots, cron jobs & internal tools {#internal-automation}

<UseCaseHeader id="internal-automation" />

**The situation.** Not every caller speaks HTTP. A Slack bot, a nightly job and a queue worker should use the same actions, with the same approvals and audit trail, without rewriting the logic.

```ts
// Same kit, called in-process. No HTTP, same contract.
slackApp.command('/refund', async ({ command, ack, respond }) => {
  await ack();
  const [orderId, amount] = command.text.split(' ');
  const result = await ai.call('refundOrder', { orderId, amount: Number(amount), reason: 'other' }, {
    caller: { kind: 'human', id: `slack:${command.user_id}`, via: 'internal' },
  });
  if (result.status === 'ok') await respond(`Refunded. Receipt ${result.receipt?.id}`);
  if (result.status === 'approval_required') await respond(`Needs approval: ${result.approval.reason}`);
  if (result.status === 'error') await respond(`${result.problem.detail}\nFix: ${result.problem.fix ?? ''}`);
});

// Nightly job: clean up abandoned carts as a named agent, so it shows up in activity and budgets
cron.schedule('0 2 * * *', () =>
  ai.call('expireCarts', { olderThanHours: 48 }, { caller: { kind: 'agent', id: 'nightly-cleanup', via: 'internal' } }));
```

Plugins can also ship their own actions and MCP tools:

```ts
ai.use({
  name: 'ops-toolkit',
  setup(kit) {
    kit.action('cacheStats', { description: 'Show cache hit rate and memory for each region.', run: () => cache.stats() });
  },
  tools: [{
    name: 'search_runbooks',
    description: 'Search internal runbooks by keyword.',
    input: z.object({ q: z.string() }),
    run: ({ q }) => runbooks.search(q),
  }],
});
```

## Pick your next step

- New to the agent layer? Read [Agent-native actions](/guide/agent-native).
- Want to change how it behaves? See [Customising & plugins](/guide/agent-plugins).
- Want to run something now? Clone the repo and run `node examples/agent-store/agent-demo.js`.
