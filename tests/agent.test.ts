import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { z } from 'zod';
import { mimi } from '../src/core/application';
import { agent, AgentKit } from '../src/agent';

type Res = { status: number; headers: http.IncomingHttpHeaders; body: any; text: string };

function request(server: http.Server, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as { port: number };
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { ...(payload && { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }), ...headers },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = raw ? JSON.parse(raw) : undefined;
          } catch {
            /* text */
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed, text: raw });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const AGENT = { 'x-agent-id': 'test-agent' };

let rpcId = 0;
const rpc = (server: http.Server, method: string, params?: unknown, headers: Record<string, string> = {}) =>
  request(server, 'POST', '/mcp', { jsonrpc: '2.0', id: ++rpcId, method, params }, { 'mcp-method': method, ...headers });

describe('agent-native actions', () => {
  let server: http.Server;
  let kit: AgentKit;
  const orders = new Map<string, { id: string; total: number; refunded: number; card: string }>();
  const sideEffects: string[] = [];
  const approvalsSeen: string[] = [];

  beforeAll(async () => {
    orders.set('ord_1', { id: 'ord_1', total: 250, refunded: 0, card: '4242' });
    orders.set('ord_2', { id: 'ord_2', total: 30, refunded: 0, card: '1881' });

    const app = mimi({ processErrorHandlers: false });
    kit = agent(app, {
      name: 'Test Store',
      description: 'A tiny store used in tests.',
      budgets: { default: { requestsPerMinute: 1000, spendPerDay: 100 }, perAgent: { 'slow-agent': { requestsPerMinute: 2 } } },
      onApprovalRequested: (a) => {
        approvalsSeen.push(a.id);
      },
      adminKey: 'secret',
    });

    kit.action('listOrders', {
      description: 'List all orders with totals and refund status.',
      when: 'Use to browse orders or find an order id.',
      http: 'GET /orders',
      input: z.object({ limit: z.number().int().positive().max(100).optional() }),
      run: ({ limit }) => [...orders.values()].slice(0, limit ?? 50),
    });

    kit.action('getOrder', {
      description: 'Fetch a single order by its id.',
      http: 'GET /orders/:orderId',
      input: z.object({ orderId: z.string() }),
      run: ({ orderId }, ctx) => orders.get(orderId) ?? ctx.fail('ORDER_NOT_FOUND', { status: 404, message: `No order ${orderId}`, fix: 'Call listOrders to find a valid id.', suggest: [{ action: 'listOrders' }] }),
    });

    kit.action('refundOrder', {
      description: 'Refund part or all of a paid order back to the original card.',
      when: 'Use when a customer wants money back on an order.',
      http: 'POST /orders/:orderId/refund',
      effect: 'spend',
      input: z.object({ orderId: z.string(), amount: z.number().positive(), reason: z.string().min(3) }),
      examples: [{ input: { orderId: 'ord_1', amount: 20, reason: 'damaged item' } }],
      cost: (i) => i.amount,
      approval: (i) => (i.amount > 50 ? 'Refunds above $50 need a human.' : false),
      async run(input, ctx) {
        const order = orders.get(input.orderId);
        if (!order) ctx.fail('ORDER_NOT_FOUND', { status: 404, message: 'No such order', suggest: [{ action: 'listOrders' }] });
        if (input.amount > order!.total - order!.refunded) {
          ctx.fail('REFUND_EXCEEDS_BALANCE', { status: 409, param: 'amount', message: 'Refund larger than remaining balance.', fix: `Refund at most ${order!.total - order!.refunded}.` });
        }
        const refundId = await ctx.effect(
          `Refund $${input.amount} to card •••${order!.card}`,
          () => {
            order!.refunded += input.amount;
            sideEffects.push(`refund:${input.orderId}:${input.amount}`);
            return `re_${sideEffects.length}`;
          },
          're_preview',
        );
        return { refundId, orderId: input.orderId, refunded: order!.refunded };
      },
      undo: async (input) => {
        orders.get(input.orderId)!.refunded -= input.amount;
        sideEffects.push(`unrefund:${input.orderId}:${input.amount}`);
      },
      next: (out) => [{ action: 'getOrder', input: { orderId: out.orderId }, why: 'See the updated order.' }],
    });

    kit.action('deleteAccount', {
      description: 'Permanently delete the customer account and all its data.',
      effect: 'destructive',
      agents: 'deny',
      input: z.object({ userId: z.string() }),
      run: () => ({ deleted: true }),
    });

    await new Promise<void>((r) => {
      server = app.listen(0, () => r());
    });
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  // ── REST binding ────────────────────────────────────────────
  it('serves a read action as REST with typed query coercion', async () => {
    const r = await request(server, 'GET', '/orders?limit=1');
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
    expect(r.headers['x-caller-kind']).toBe('human');
  });

  it('wraps responses in an agent envelope for agents (with next affordances)', async () => {
    const r = await request(server, 'POST', '/orders/ord_2/refund', { amount: 5, reason: 'late delivery' }, AGENT);
    expect(r.status).toBe(200);
    expect(r.body.data.refunded).toBe(5);
    expect(r.body.receipt.id).toMatch(/^rcpt_/);
    expect(r.body.receipt.undoable).toBe(true);
    expect(r.body.receipt.effects[0]).toContain('Refund $5');
    expect(r.body.next[0]).toMatchObject({ action: 'getOrder', input: { orderId: 'ord_2' } });
  });

  // ── Errors agents can recover from ──────────────────────────
  it('returns RFC 9457 problems with field-level fixes and an example', async () => {
    const r = await request(server, 'POST', '/orders/ord_1/refund', { amount: '10' }, AGENT);
    expect(r.status).toBe(422);
    expect(r.headers['content-type']).toContain('application/problem+json');
    expect(r.body.code).toBe('INVALID_INPUT');
    expect(r.body.fix).toContain('`amount`');
    expect(r.body.fix).toContain('add `reason`');
    expect(r.body.example).toEqual({ orderId: 'ord_1', amount: 20, reason: 'damaged item' });
    expect(r.body.retriable).toBe(false);
  });

  it('domain errors carry fix + suggestions', async () => {
    const r = await request(server, 'GET', '/orders/nope');
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ code: 'ORDER_NOT_FOUND', fix: 'Call listOrders to find a valid id.', suggest: [{ action: 'listOrders' }] });
  });

  // ── Dry run ─────────────────────────────────────────────────
  it('dry-run returns a plan and performs no side effects', async () => {
    const before = sideEffects.length;
    const r = await request(server, 'POST', '/orders/ord_1/refund?dryRun=true', { amount: 10, reason: 'damaged item' }, AGENT);
    expect(r.status).toBe(200);
    expect(r.headers['preference-applied']).toBe('dry-run');
    expect(r.body.plan).toMatchObject({
      action: 'refundOrder',
      effect: 'spend',
      cost: 10,
      reversible: true,
      approvalRequired: false,
      effects: [{ label: 'Refund $10 to card •••4242', executed: false }],
      wouldReturn: { refundId: 're_preview' },
    });
    expect(sideEffects.length).toBe(before);
  });

  it('dry-run surfaces business-rule failures before anything happens', async () => {
    const r = await request(server, 'POST', '/orders/ord_2/refund', { amount: 26, reason: 'too much' }, { ...AGENT, prefer: 'dry-run' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('REFUND_EXCEEDS_BALANCE');
    expect(r.body.fix).toBe('Refund at most 25.');
  });

  // ── Idempotency ─────────────────────────────────────────────
  it('idempotency keys replay the original result without repeating the effect', async () => {
    const before = sideEffects.length;
    const h = { ...AGENT, 'idempotency-key': 'k-1' };
    const a = await request(server, 'POST', '/orders/ord_1/refund', { amount: 1, reason: 'idem test' }, h);
    const b = await request(server, 'POST', '/orders/ord_1/refund', { amount: 1, reason: 'idem test' }, h);
    expect(a.body.data.refundId).toBe(b.body.data.refundId);
    expect(b.headers['idempotent-replayed']).toBe('idempotency-key');
    expect(sideEffects.length).toBe(before + 1);

    const c = await request(server, 'POST', '/orders/ord_1/refund', { amount: 2, reason: 'idem test' }, h);
    expect(c.status).toBe(422);
    expect(c.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('auto-dedupes identical agent writes fired twice by mistake', async () => {
    const before = sideEffects.length;
    const h = { 'x-agent-id': 'dup-agent' };
    await request(server, 'POST', '/orders/ord_1/refund', { amount: 3, reason: 'double fire' }, h);
    const second = await request(server, 'POST', '/orders/ord_1/refund', { amount: 3, reason: 'double fire' }, h);
    expect(second.body.replayed).toBe('auto-dedupe');
    expect(sideEffects.length).toBe(before + 1);
  });

  // ── Approvals ───────────────────────────────────────────────
  it('parks risky calls for human approval, then executes the exact approved plan', async () => {
    const before = sideEffects.length;
    const r = await request(server, 'POST', '/orders/ord_1/refund', { amount: 60, reason: 'broken on arrival' }, AGENT);
    expect(r.status).toBe(202);
    expect(r.body.approval.reason).toBe('Refunds above $50 need a human.');
    expect(r.body.approval.plan.effects[0].label).toBe('Refund $60 to card •••4242');
    expect(r.headers.location).toBe(r.body.approval.statusUrl);
    expect(sideEffects.length).toBe(before);
    expect(approvalsSeen).toContain(r.body.approval.id);

    // The agent cannot approve its own request
    const self = await request(server, 'POST', `/_agent/approvals/${r.body.approval.id}/approve`, undefined, AGENT);
    expect(self.status).toBe(403);

    const ok = await request(server, 'POST', `/_agent/approvals/${r.body.approval.id}/approve`, undefined, { 'x-admin-key': 'secret' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('executed');
    expect(ok.body.result.refundId).toMatch(/^re_/);

    const poll = await request(server, 'GET', r.body.approval.statusUrl, undefined, AGENT);
    expect(poll.body.status).toBe('executed');
    expect(sideEffects.length).toBe(before + 1);
  });

  it('turns spend beyond the daily agent budget into an approval request', async () => {
    const h = { 'x-agent-id': 'big-spender' };
    // budget is 100/day; 45 + 45 fits, the third pushes over
    expect((await request(server, 'POST', '/orders/ord_1/refund', { amount: 45, reason: 'one' }, h)).status).toBe(200);
    expect((await request(server, 'POST', '/orders/ord_1/refund', { amount: 45, reason: 'two' }, h)).status).toBe(200);
    const third = await request(server, 'POST', '/orders/ord_1/refund', { amount: 20, reason: 'three' }, h);
    expect(third.status).toBe(202);
    expect(third.body.approval.reason).toContain("daily budget");
  });

  // ── Policy, budgets ─────────────────────────────────────────
  it('blocks agents from human-only actions', async () => {
    const r = await request(server, 'POST', '/actions/deleteAccount', { userId: 'u1' }, AGENT);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('AGENTS_NOT_ALLOWED');
    const human = await request(server, 'POST', '/actions/deleteAccount', { userId: 'u1' });
    expect(human.status).toBe(200);
  });

  it('enforces per-agent rate limits with standard headers', async () => {
    const h = { 'x-agent-id': 'slow-agent' };
    const a = await request(server, 'GET', '/orders', undefined, h);
    expect(a.headers['ratelimit-limit']).toBe('2');
    await request(server, 'GET', '/orders', undefined, h);
    const c = await request(server, 'GET', '/orders', undefined, h);
    expect(c.status).toBe(429);
    expect(c.body.retriable).toBe(true);
    expect(Number(c.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('recognises well-known agent user-agents', async () => {
    const r = await request(server, 'GET', '/orders', undefined, { 'user-agent': 'Mozilla/5.0 (compatible; Claude-User/1.0)' });
    expect(r.headers['x-caller-kind']).toBe('agent');
  });

  // ── Receipts & undo ─────────────────────────────────────────
  it('undoes a receipt via its compensating action', async () => {
    const h = { 'x-agent-id': 'undo-agent' };
    const r = await request(server, 'POST', '/orders/ord_2/refund', { amount: 4, reason: 'oops undo' }, h);
    const refundedBefore = orders.get('ord_2')!.refunded;
    const u = await request(server, 'POST', `/_agent/receipts/${r.body.receipt.id}/undo`, undefined, h);
    expect(u.status).toBe(200);
    expect(orders.get('ord_2')!.refunded).toBe(refundedBefore - 4);
    const again = await request(server, 'POST', `/_agent/receipts/${r.body.receipt.id}/undo`, undefined, h);
    expect(again.body.code).toBe('ALREADY_UNDONE');
    const stranger = await request(server, 'POST', `/_agent/receipts/${r.body.receipt.id}/undo`, undefined, AGENT);
    expect(stranger.status).toBe(403);
  });

  // ── Discovery ───────────────────────────────────────────────
  it('publishes /.well-known/agent.json and /llms.txt', async () => {
    const m = await request(server, 'GET', '/.well-known/agent.json');
    expect(m.body.name).toBe('Test Store');
    expect(m.body.actions.map((a: any) => a.name)).toEqual(['listOrders', 'getOrder', 'refundOrder', 'deleteAccount']);
    const refund = m.body.actions.find((a: any) => a.name === 'refundOrder');
    expect(refund).toMatchObject({ effect: 'spend', reversible: true, approval: 'conditional', http: { method: 'POST', path: '/orders/:orderId/refund' } });
    expect(refund.input.properties.amount.type).toBe('number');

    const t = await request(server, 'GET', '/llms.txt');
    expect(t.headers['content-type']).toContain('text/markdown');
    expect(t.text).toContain('**refundOrder** — `POST /orders/:orderId/refund`');
    expect(t.text).toContain('humans only');
  });

  it('finds the right action from a natural-language intent', async () => {
    const r = await request(server, 'GET', '/_agent/find?q=customer+wants+their+money+back');
    expect(r.body.results[0].name).toBe('refundOrder');
    const r2 = await request(server, 'GET', '/_agent/find?q=show+me+all+purchases');
    expect(r2.body.results[0].name).toBe('listOrders');
  });

  // ── MCP ─────────────────────────────────────────────────────
  it('speaks MCP: initialize (legacy) and server/discover (stateless)', async () => {
    const init = await rpc(server, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    expect(init.body.result.protocolVersion).toBe('2025-06-18');
    expect(init.body.result.serverInfo.name).toBe('Test Store');
    expect(init.body.result.instructions).toContain('_dryRun');

    const note = await request(server, 'POST', '/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(note.status).toBe(202);

    const disc = await rpc(server, 'server/discover', { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } });
    expect(disc.body.result.protocolVersions).toContain('2026-07-28');
    expect(disc.body.result.resultType).toBe('complete');
  });

  it('lists actions as MCP tools with safety annotations', async () => {
    const r = await rpc(server, 'tools/list');
    const tools = r.body.result.tools;
    const refund = tools.find((t: any) => t.name === 'refundOrder');
    expect(refund.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
    expect(refund.inputSchema.properties._dryRun.type).toBe('boolean');
    expect(refund.inputSchema.properties._idempotencyKey.type).toBe('string');
    expect(refund.description).toContain('When to use:');
    expect(tools.find((t: any) => t.name === 'listOrders').annotations.readOnlyHint).toBe(true);
    expect(tools.map((t: any) => t.name)).toEqual(expect.arrayContaining(['check_approval', 'undo_action']));
  });

  it('runs tools over MCP with the same contract (dry run, approval, errors)', async () => {
    const plan = await rpc(server, 'tools/call', { name: 'refundOrder', arguments: { orderId: 'ord_1', amount: 7, reason: 'mcp plan', _dryRun: true } }, { 'mcp-name': 'refundOrder' });
    expect(plan.body.result.structuredContent.plan.effects[0].executed).toBe(false);

    const big = await rpc(server, 'tools/call', { name: 'refundOrder', arguments: { orderId: 'ord_1', amount: 70, reason: 'mcp approval' } });
    const approvalId = big.body.result.structuredContent.approval.id;
    expect(big.body.result.structuredContent.status).toBe('approval_required');

    const check = await rpc(server, 'tools/call', { name: 'check_approval', arguments: { approvalId } });
    expect(check.body.result.structuredContent.status).toBe('pending');

    const bad = await rpc(server, 'tools/call', { name: 'getOrder', arguments: { orderId: 'zzz' } });
    expect(bad.body.result.isError).toBe(true);
    expect(bad.body.result.structuredContent.code).toBe('ORDER_NOT_FOUND');

    const unknown = await rpc(server, 'tools/call', { name: 'nope', arguments: {} });
    expect(unknown.body.error.code).toBe(-32602);
  });

  it('switches to progressive disclosure (find/describe/run) when there are many actions', async () => {
    const app = mimi({ processErrorHandlers: false });
    const big = agent(app, { name: 'Big', maxTools: 3 });
    for (let i = 0; i < 5; i++) big.action(`thing${i}`, { description: `Does thing number ${i} for testing`, run: () => i });
    big.action('archiveProject', { description: 'Archive a project so it becomes read-only.', effect: 'write', run: () => 'archived' });
    const s = await new Promise<http.Server>((r) => {
      const srv = app.listen(0, () => r(srv));
    });
    const list = await rpc(s, 'tools/list');
    expect(list.body.result.tools.map((t: any) => t.name)).toEqual(['find_actions', 'describe_action', 'run_action']);
    const found = await rpc(s, 'tools/call', { name: 'find_actions', arguments: { intent: 'archive my project' } });
    expect(found.body.result.structuredContent.results[0].name).toBe('archiveProject');
    const ran = await rpc(s, 'tools/call', { name: 'run_action', arguments: { name: 'archiveProject', input: {} } });
    expect(ran.body.result.structuredContent.data).toBe('archived');
    await new Promise<void>((r) => s.close(() => r()));
  });

  // ── Insights ────────────────────────────────────────────────
  it('reports agent-DX insights and an audit trail to operators only', async () => {
    await request(server, 'POST', '/orders/ord_1/refund', { orderId: 'ord_1', amount: '9', reason: 'x1' }, AGENT);
    const denied = await request(server, 'GET', '/_agent/insights', undefined, AGENT);
    expect(denied.status).toBe(403);
    const r = await request(server, 'GET', '/_agent/insights', undefined, { 'x-admin-key': 'secret' });
    const refund = r.body.actions.find((a: any) => a.action === 'refundOrder');
    expect(refund.agentCalls).toBeGreaterThan(3);
    expect(refund.hints.join(' ')).toContain('`amount` as string instead of number');
    const act = await request(server, 'GET', '/_agent/activity?agent=test-agent', undefined, { 'x-admin-key': 'secret' });
    expect(act.body.events.length).toBeGreaterThan(0);
    expect(act.body.events.every((e: any) => e.caller.id === 'test-agent')).toBe(true);
  });

  it('in-process kit.call() follows the same contract', async () => {
    const o = await kit.call('refundOrder', { orderId: 'ord_2', amount: 1, reason: 'internal' }, { dryRun: true });
    expect(o.status).toBe('dry_run');
    const miss = await kit.call('refundOrdr', {});
    expect(miss.status).toBe('error');
    if (miss.status === 'error') expect(miss.problem.suggest?.[0].action).toBe('refundOrder');
  });
});
