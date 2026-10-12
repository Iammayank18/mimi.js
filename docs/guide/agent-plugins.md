# Customising the Agent Layer

Every part of the agent layer can be changed without forking mimi.js. There are three levels. Use the smallest one that does the job.

| Level | Use it for | How |
|---|---|---|
| **Per action** | Rules for one endpoint | Fields on `ai.action()`: `approval`, `cost`, `agents`, `undo`, `next`, `examples` |
| **Options** | Swapping infrastructure or a strategy | `agent(app, { store, identify, rank, formatResponse, … })` |
| **Plugins** | Cross-cutting behaviour you can share | `ai.use(plugin)` or `agent(app, { plugins: [...] })` |

## Plugins

A plugin is a plain object. Every field is optional except `name`.

```ts
import type { AgentPlugin } from 'mimi.js';

const myPlugin: AgentPlugin = {
  name: 'my-plugin',

  setup(kit) {},                 // once, when added. You can register actions here.
  onRegister(action) {},         // every action definition. Modify it, or throw to reject it.
  beforeCall(call) {},           // every call, after validation
  approval(call) {},             // return a reason string to require human approval
  afterCall(call, outcome) {},   // inspect or replace the result
  onEvent(event) {},             // calls, approvals, undos, for logging and metrics
  tools: [],                     // extra MCP tools
  routes(app, kit) {},           // extra HTTP routes
};

ai.use(myPlugin);
```

### The order of hooks for one call

```
validate input
  → beforeCall      (change input, reject, or short-circuit)
  → policy + budgets
  → approval        (plugin rules after the action's own rule)
  → run / dry-run plan / park for approval
  → afterCall       (change or replace the outcome)
  → onEvent         (observers; errors here never affect the call)
```

`call.state` is a scratch object shared by all hooks during one call. Use it for timers, trace ids or cache flags.

### What each hook can do

**`beforeCall(call)`**
- Change `call.input`, e.g. normalise an email or fill in defaults from the session.
- Throw an `ActionError` to reject the call. The agent gets a structured error with your `fix`.
- Return an outcome to skip execution, e.g. serve a cached result.

**`approval(call)`**: add company-wide approval rules that apply to every action.

**`afterCall(call, outcome)`**: return a new outcome to redact data, add `next` suggestions, or translate errors.

**`onRegister(action)`**: governance. For example, "every spend action must have undo" or "every action needs a `when`". You can also add tags or defaults.

**`onEvent(event)`**: event types are `call`, `approval.requested`, `approval.decided` and `undo`. Send them to Datadog, OpenTelemetry, a database or Slack.

**`setup(kit)`**: a plugin can ship its own actions, e.g. a billing plugin that adds `getInvoice` and `refundInvoice`.

**`tools`**: MCP-only tools that aren't actions, such as a docs search or a server status tool.

**`routes(app)`**: dashboards, webhooks or health checks.

## Built-in plugins

They are small on purpose, so you can read one as an example and write your own.

```ts
import { agent, redact, approvalRule, scopes, requireUndo, auditLog, cacheReads } from 'mimi.js';

agent(app, {
  plugins: [
    requireUndo(),                                     // refuse spend/destructive actions without undo()
    redact({ fields: ['cardNumber', 'ssn'] }),          // hide PII from agents
    scopes({ 'support-bot': ['getOrder', 'refundOrder'] }), // what each agent may call
    approvalRule('weekends', (call) =>
      call.caller.kind === 'agent' && [0, 6].includes(new Date().getDay()) && 'No agent writes on weekends.'),
    auditLog((event) => db.audit.insert(event)),        // keep a permanent audit trail
    cacheReads({ ttlMs: 30_000 }),                      // cache read actions
  ],
});
```

| Plugin | Hook it uses | What it does |
|---|---|---|
| `redact({ fields, for? })` | `afterCall` | Masks fields deeply in responses (agents only by default) |
| `approvalRule(name, fn)` | `approval` | Adds a global approval rule |
| `scopes(map, { defaultScope })` | `beforeCall` | Per-agent allow-list of actions |
| `requireUndo({ effects })` | `onRegister` | Governance check when actions are defined |
| `auditLog(sink, { types })` | `onEvent` | Streams events to your own storage |
| `cacheReads({ ttlMs, actions })` | `beforeCall` + `afterCall` | Short-circuits repeated reads |

## Options for swapping strategies

```ts
agent(app, {
  store: redisStore,                     // where idempotency, approvals, receipts and budgets live
  identify: (req) => verifyToken(req),   // who is calling: API keys, JWT, signed agent requests
  authorizeAdmin: (req) => isStaff(req), // who may approve and see insights
  onApprovalRequested: (a) => slack.post(a),
  rank: (query, actions, limit) => vectorSearch(query, actions, limit), // replace intent search
  agentPatterns: [[/acmebot/i, 'AcmeBot']],                            // recognise your own bots
  formatResponse: (outcome, { caller, action }) => myEnvelope(outcome), // your own response shape
  problemBaseUrl: 'https://api.acme.com/errors/',                       // your own error docs
});
```

A `store` is any object with `get`, `set(key, value, ttlMs)`, `setIfAbsent` and `delete`. For Redis, `setIfAbsent` is `SET key value NX PX ttl`.

## Example: a plugin to publish as a package

```ts
// @acme/mimi-slack-approvals
import type { AgentPlugin } from 'mimi.js';

export function slackApprovals(webhookUrl: string): AgentPlugin {
  return {
    name: 'slack-approvals',
    async onEvent(event) {
      if (event.type !== 'approval.requested') return;
      const { approval } = event;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `🔔 ${approval.caller.name ?? approval.caller.id} wants to run *${approval.action}*: ${approval.reason}\n` +
                approval.plan.effects.map((e) => `• ${e.label}`).join('\n'),
        }),
      });
    },
  };
}
```

Users install it with one line: `ai.use(slackApprovals(process.env.SLACK_WEBHOOK))`.
