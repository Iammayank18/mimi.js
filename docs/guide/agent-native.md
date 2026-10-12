# Agent-Native Actions

Your next API consumer is an AI agent. Agents call your API differently from the code a developer writes:

- they **retry** when they're unsure,
- they **guess** parameters when the docs are vague,
- they **loop** on vague error messages,
- they can be **tricked** by prompt injection into doing things nobody wanted,
- and they **fill their context window** if you hand them 200 endpoints.

mimi.js handles this at the framework level. You define an **action** once. mimi serves it to humans and to agents, and every call follows the same safety contract.

```ts
import mimi, { agent } from 'mimi.js';
import { z } from 'zod';

const app = mimi();
const ai = agent(app, { name: 'Acme Store' });

ai.action('refundOrder', {
  description: 'Refund part or all of a paid order to the original card.',
  when: 'Use when a customer wants money back on an order.',
  http: 'POST /orders/:orderId/refund',
  effect: 'spend',
  input: z.object({ orderId: z.string(), amount: z.number().positive(), reason: z.string() }),
  cost: (i) => i.amount,
  approval: (i) => i.amount > 100 && 'Refunds over $100 need a human.',

  async run(input, ctx) {
    const order = await db.orders.get(input.orderId);
    if (!order) ctx.fail('ORDER_NOT_FOUND', { status: 404, fix: 'Call listOrders to find the id.' });

    await ctx.effect(`Refund $${input.amount} to card •••${order.last4}`, () =>
      payments.refund(order.chargeId, input.amount),
    );
    return { orderId: order.id, refunded: input.amount };
  },

  undo: (input) => payments.charge(input.orderId, input.amount),
  next: (out) => [{ action: 'getOrder', input: { orderId: out.orderId }, why: 'See the updated order' }],
});

app.listen(3000);
```

That one definition gives you:

| Surface | Where |
|---|---|
| REST endpoint | `POST /orders/:orderId/refund` |
| MCP tool (Claude, ChatGPT, Cursor, …) | `POST /mcp` |
| Agent manifest | `GET /.well-known/agent.json` |
| LLM-readable docs | `GET /llms.txt` |
| OpenAPI / Swagger | `/api-docs` (when `docs` is enabled) |
| Intent search | `GET /_agent/find?q=give+money+back` |

## The agent contract

### 1. `effect` — say what the action does

`'read' | 'write' | 'destructive' | 'spend' | 'external'`. This one field sets the defaults for the rest of the contract: reads skip idempotency, writes get receipts, and MCP tool hints (`readOnlyHint`, `destructiveHint`, `openWorldHint`) are derived from it.

### 2. Dry run (plan mode)

Any action can be previewed without changing anything:

```bash
curl -X POST 'localhost:3000/orders/ord_1/refund?dryRun=true' -d '{"amount":40,"reason":"damaged"}'
```

```json
{
  "dryRun": true,
  "plan": {
    "effects": [{ "label": "Refund $40 to card •••4242", "executed": false }],
    "cost": 40,
    "reversible": true,
    "approvalRequired": false,
    "wouldReturn": { "orderId": "ord_1", "refunded": 40 }
  }
}
```

The handler really runs: reads happen and validations fire. Anything wrapped in `ctx.effect(label, fn, preview?)` is recorded instead of executed. **Wrap every side effect in `ctx.effect`.** That wrapper is what lets your API show a plan before it acts.

Triggers: `?dryRun=true`, header `Prefer: dry-run`, header `X-Dry-Run: 1`, or `_dryRun: true` in MCP arguments.

### 3. Idempotency, built in

- `Idempotency-Key` header (REST) or `_idempotencyKey` (MCP): a retry with the same key returns the original result and never repeats the side effect. Reusing a key with a different input returns `IDEMPOTENCY_KEY_REUSED`.
- **Auto-dedupe**: when an agent sends the exact same write twice within 10 s (`autoDedupeMs`), the second call replays the first result. This catches agents that double-fire after a timeout.

### 4. Approval gates (human in the loop)

```ts
approval: (input, { caller }) => input.amount > 100 && 'Refunds over $100 need a human.'
agents: 'approval'   // every agent call needs approval
agents: 'deny'       // humans only
```

A gated call returns **HTTP 202** with the exact plan. The human approves **that stored call**, so the agent cannot change the input afterwards. mimi then executes it, and the agent polls for the result:

```
POST /_agent/approvals/:id/approve   (operators only)
POST /_agent/approvals/:id/reject
GET  /_agent/approvals/:id           (agent polls; MCP: check_approval tool)
```

Hook `onApprovalRequested(approval)` to notify Slack, email or a dashboard.

### 5. Errors agents can recover from

Every failure is RFC 9457 `application/problem+json` with extra fields for agents:

```json
{
  "code": "INVALID_INPUT",
  "status": 422,
  "fix": "Retry with these changes: send `amount` as number, not string; add `reason` (string).",
  "issues": [{ "path": "amount", "expected": "number", "received": "string" }],
  "example": { "orderId": "ord_1", "amount": 20, "reason": "damaged item" },
  "retriable": false,
  "suggest": [{ "action": "listOrders" }]
}
```

Throw your own with `ctx.fail(code, { status, fix, param, retriable, retryAfter, suggest })`. 5xx details are never leaked.

### 6. Receipts and undo

Every write returns a receipt (`X-Receipt-Id` header, or `receipt` in the agent envelope). If the action defines `undo`, the caller who made the call, or an operator, can reverse it:

```
POST /_agent/receipts/:id/undo     (MCP: undo_action tool)
```

### 7. Caller identity, budgets and audit

mimi identifies callers as `human` or `agent` by checking, in this order: your `identify(req)` hook, the MCP transport, the `X-Agent-Id` header, the Web Bot Auth `Signature-Agent` header, and known agent User-Agents. Then:

```ts
agent(app, {
  budgets: {
    default: { requestsPerMinute: 60, spendPerDay: 500 },
    perAgent: { 'partner-bot': { spendPerDay: 5000 } },
  },
});
```

- Exceeding `requestsPerMinute` returns 429 with `RateLimit-*` and `Retry-After` headers.
- Exceeding `spendPerDay` doesn't fail. **It turns the call into an approval request.**
- `GET /_agent/activity?agent=claude` shows the full audit trail.

### 8. Shaped responses

Humans and plain HTTP clients get your data as-is. Agents (or `Accept: application/vnd.mimi.agent+json`) get an envelope:

```json
{ "data": {...}, "receipt": { "id": "rcpt_…", "undoable": true }, "next": [{ "action": "getOrder", "input": {...} }] }
```

`next` gives the agent its likely next steps, so it doesn't have to guess what to call.

### 9. Progressive disclosure for big APIs

Tool-selection accuracy drops once an agent sees more than about 30 tools. Once you pass `maxTools` (default 24), the MCP server stops listing every action and exposes three meta-tools instead: `find_actions` (intent search), `describe_action`, and `run_action`. The agent loads only what it needs.

### 10. Agent-DX insights

`GET /_agent/insights` shows where agents struggle with your API and what to change:

```json
{
  "action": "refundOrder",
  "agentCalls": 412,
  "errorRate": 0.08,
  "hints": [
    "Agents sent `amount` as string instead of number 23×. Accept string (e.g. z.coerce) or add an example.",
    "No `undo` handler — agent mistakes here need manual cleanup."
  ]
}
```

## Connect a real agent

Add `http://localhost:3000/mcp` as a remote MCP server in your client (Claude Desktop/Code, Cursor, ChatGPT connectors…). The server speaks both the stateless MCP `2026-07-28` revision (`server/discover`) and the earlier `initialize` handshake.

## Options

| Option | Default | |
|---|---|---|
| `name`, `version`, `description`, `instructions` | — | Shown in manifest, llms.txt, MCP |
| `basePath` | `/_agent` | System endpoints |
| `mcpPath` | `/mcp` | `false` disables MCP |
| `maxTools` | `24` | Switch to progressive disclosure above this |
| `identify(req)` | — | Custom identity (verify signatures, API keys) |
| `budgets` | — | Per-agent rate and spend limits |
| `autoDedupeMs` | `10000` | `0` disables |
| `idempotencyTtlMs` | 24h | |
| `approvalTtlMs` | 1h | |
| `undoWindowMs` | 24h | |
| `adminKey` / `authorizeAdmin(req)` | dev: open, prod: closed | Guards approve/activity/insights |
| `onApprovalRequested(a)` | — | Notify humans |
| `store` | in-memory | Any `KVStore`; use Redis for multiple instances |
