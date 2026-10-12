import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { z } from 'zod';
import { mimi } from '../src/core/application';
import { agent, ActionError, AgentKit, redact, approvalRule, scopes, requireUndo, auditLog, cacheReads } from '../src/agent';
import type { AgentEvent, AgentPlugin } from '../src/agent';

type Res = { status: number; headers: http.IncomingHttpHeaders; body: any };

function request(server: http.Server, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as { port: number };
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method, headers: { ...(payload && { 'content-type': 'application/json' }), ...headers } },
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
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const listen = (app: any) => new Promise<http.Server>((r) => { const s = app.listen(0, () => r(s)); });
const close = (s: http.Server) => new Promise<void>((r) => s.close(() => r()));
let rpcId = 0;
const rpc = (s: http.Server, method: string, params?: unknown, headers: Record<string, string> = {}) =>
  request(s, 'POST', '/mcp', { jsonrpc: '2.0', id: ++rpcId, method, params }, headers);

describe('agent plugins — custom hooks', () => {
  let server: http.Server;
  let kit: AgentKit;
  const events: AgentEvent[] = [];
  const hookOrder: string[] = [];
  let reads = 0;

  beforeAll(async () => {
    const app = mimi({ processErrorHandlers: false });

    const tracer: AgentPlugin = {
      name: 'tracer',
      beforeCall(call) {
        hookOrder.push(`before:${call.action.name}`);
        call.state.t0 = Date.now();
      },
      afterCall(call, outcome) {
        hookOrder.push(`after:${call.action.name}:${outcome.status}`);
        expect(call.state.t0).toBeTypeOf('number');
      },
    };

    const normalise: AgentPlugin = {
      name: 'normalise-email',
      beforeCall(call) {
        if (call.action.name === 'subscribe') {
          call.input = { ...(call.input as any), email: String((call.input as any).email).toLowerCase() };
        }
      },
    };

    const contributor: AgentPlugin = {
      name: 'health',
      setup(k) {
        k.action('ping', { description: 'Health check contributed by a plugin.', run: () => 'pong' });
      },
      tools: [
        {
          name: 'server_time',
          description: 'Return the current server time (custom MCP tool from a plugin).',
          input: z.object({ tz: z.string().default('UTC') }),
          run: (args, ctx) => ({ tz: args.tz, caller: ctx.caller.kind }),
        },
      ],
      routes(app) {
        app.get('/plugin/hello', (_req: any, res: any) => res.json({ hello: 'from plugin' }));
      },
    };

    const tagger: AgentPlugin = {
      name: 'tagger',
      onRegister(action) {
        action.tags = [...(action.tags ?? []), `effect:${action.effect}`];
      },
    };

    kit = agent(app, {
      name: 'Plugins',
      adminKey: 'k',
      agentPatterns: [[/acmebot/, 'AcmeBot']],
      problemBaseUrl: 'https://api.acme.test/errors',
      plugins: [
        tagger,
        tracer,
        normalise,
        contributor,
        redact({ fields: ['cardNumber', 'ssn'] }),
        approvalRule('night-shift', (call) => call.caller.kind === 'agent' && (call.input as any)?.night === true && 'Agents need approval at night.'),
        scopes({ 'reader-bot': ['getProfile', 'ping'] }),
        auditLog((e) => {
          events.push(e);
        }),
        cacheReads({ actions: ['slowRead'] }),
      ],
    });

    kit.action('getProfile', {
      description: 'Get the customer profile including payment details.',
      input: z.object({ id: z.string() }),
      run: ({ id }) => ({ id, name: 'Sam', cardNumber: '4242424242424242', nested: { ssn: '123-45-6789' } }),
    });
    kit.action('subscribe', {
      description: 'Subscribe an email address to the newsletter.',
      effect: 'write',
      input: z.object({ email: z.string().email(), night: z.boolean().optional() }),
      run: ({ email }) => ({ subscribed: email }),
    });
    kit.action('slowRead', {
      description: 'An expensive read that benefits from caching.',
      input: z.object({ q: z.string() }),
      run: ({ q }) => ({ q, n: ++reads }),
    });
    kit.action('vetoed', {
      description: 'An action a plugin will veto for some inputs.',
      effect: 'write',
      input: z.object({ ok: z.boolean() }),
      run: () => 'ran',
    });
    kit.use({
      name: 'veto',
      beforeCall(call) {
        if (call.action.name === 'vetoed' && !(call.input as any).ok) {
          throw new ActionError({ code: 'POLICY_VETO', status: 403, message: 'Vetoed by company policy.', fix: 'Set ok: true.' });
        }
      },
    });

    server = await listen(app);
  });

  afterAll(() => close(server));

  it('runs beforeCall → afterCall around each call with shared state', async () => {
    hookOrder.length = 0;
    await request(server, 'GET', '/actions/getProfile?id=1');
    expect(hookOrder).toEqual(['before:getProfile', 'after:getProfile:ok']);
  });

  it('beforeCall can rewrite the validated input', async () => {
    const r = await request(server, 'POST', '/actions/subscribe', { email: 'SAM@Example.COM' });
    expect(r.body).toEqual({ subscribed: 'sam@example.com' });
  });

  it('beforeCall can veto with a structured error; problemBaseUrl customises the type link', async () => {
    const r = await request(server, 'POST', '/actions/vetoed', { ok: false });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'POLICY_VETO', fix: 'Set ok: true.', type: 'https://api.acme.test/errors/policy-veto' });
    expect((await request(server, 'POST', '/actions/vetoed', { ok: true })).body).toBe('ran');
  });

  it('redact() hides sensitive fields from agents but not humans', async () => {
    const agentRes = await request(server, 'GET', '/actions/getProfile?id=1', undefined, { 'x-agent-id': 'a1' });
    expect(agentRes.body.data.cardNumber).toBe('[redacted]');
    expect(agentRes.body.data.nested.ssn).toBe('[redacted]');
    const human = await request(server, 'GET', '/actions/getProfile?id=1');
    expect(human.body.cardNumber).toBe('4242424242424242');
  });

  it('approvalRule() adds a global approval policy', async () => {
    const r = await request(server, 'POST', '/actions/subscribe', { email: 'a@b.co', night: true }, { 'x-agent-id': 'a2' });
    expect(r.status).toBe(202);
    expect(r.body.approval.reason).toBe('Agents need approval at night.');
  });

  it('scopes() limits which actions an agent may call', async () => {
    const h = { 'x-agent-id': 'reader-bot' };
    expect((await request(server, 'GET', '/actions/getProfile?id=1', undefined, h)).status).toBe(200);
    const r = await request(server, 'POST', '/actions/subscribe', { email: 'a@b.co' }, h);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('OUT_OF_SCOPE');
    expect(r.body.fix).toContain('getProfile, ping');
  });

  it('cacheReads() short-circuits repeated reads', async () => {
    const a = await request(server, 'GET', '/actions/slowRead?q=x');
    const b = await request(server, 'GET', '/actions/slowRead?q=x');
    const c = await request(server, 'GET', '/actions/slowRead?q=y');
    expect(a.body.n).toBe(b.body.n);
    expect(c.body.n).toBe(a.body.n + 1);
  });

  it('onRegister can modify every action (tags show up in the manifest)', async () => {
    const m = await request(server, 'GET', '/.well-known/agent.json');
    expect(m.body.actions.find((x: any) => x.name === 'subscribe').tags).toContain('effect:write');
  });

  it('plugins can contribute actions, MCP tools and HTTP routes', async () => {
    expect((await request(server, 'GET', '/actions/ping')).body).toBe('pong');
    expect((await request(server, 'GET', '/plugin/hello')).body).toEqual({ hello: 'from plugin' });

    const list = await rpc(server, 'tools/list');
    const tool = list.body.result.tools.find((t: any) => t.name === 'server_time');
    expect(tool.inputSchema.properties.tz.type).toBe('string');
    const call = await rpc(server, 'tools/call', { name: 'server_time', arguments: {} });
    expect(call.body.result.structuredContent).toEqual({ tz: 'UTC', caller: 'agent' });
  });

  it('auditLog() receives call, approval and undo events', async () => {
    const types = new Set(events.map((e) => e.type));
    expect(types.has('call')).toBe(true);
    expect(types.has('approval.requested')).toBe(true);
  });

  it('agentPatterns recognise custom bots', async () => {
    const r = await request(server, 'GET', '/actions/ping', undefined, { 'user-agent': 'AcmeBot/2.0' });
    expect(r.headers['x-caller-kind']).toBe('agent');
  });
});

describe('agent plugins — strategies and governance', () => {
  it('requireUndo() rejects risky actions without undo', () => {
    const app = mimi({ processErrorHandlers: false });
    const ai = agent(app, { plugins: [requireUndo()] });
    expect(() => ai.action('charge', { description: 'Charge the card on file.', effect: 'spend', run: () => 1 })).toThrow(/must define undo/);
    expect(() => ai.action('charge2', { description: 'Charge the card on file.', effect: 'spend', run: () => 1, undo: () => 0 })).not.toThrow();
  });

  it('rank option replaces intent search', async () => {
    const app = mimi({ processErrorHandlers: false });
    const ai = agent(app, { rank: (_q, actions) => actions.filter((a) => a.name === 'b').map((a) => ({ name: a.name, score: 1 })) });
    ai.action('a', { description: 'Refund money to a customer.', run: () => 1 });
    ai.action('b', { description: 'Something unrelated entirely.', run: () => 2 });
    const r = await ai.find('refund');
    expect(r.map((x) => x.name)).toEqual(['b']);
  });

  it('formatResponse fully controls the HTTP shape', async () => {
    const app = mimi({ processErrorHandlers: false });
    const ai = agent(app, {
      formatResponse: (outcome, { action }) =>
        outcome.status === 'ok' ? { status: 200, headers: { 'x-shape': 'custom' }, body: { ok: true, action, result: outcome.data } } : undefined,
    });
    ai.action('hello', { description: 'Say hello to the caller.', run: () => 'hi' });
    const s = await listen(app);
    const r = await request(s, 'GET', '/actions/hello');
    expect(r.headers['x-shape']).toBe('custom');
    expect(r.body).toEqual({ ok: true, action: 'hello', result: 'hi' });
    await close(s);
  });

  it('standalone AgentKit accepts plugins too', async () => {
    const seen: string[] = [];
    const kit = new AgentKit({ plugins: [{ name: 'spy', beforeCall: (c) => void seen.push(c.action.name) }] });
    kit.action('x', { description: 'An in-process only action.', run: () => 42 });
    const o = await kit.call('x', {});
    expect(o).toMatchObject({ status: 'ok', data: 42 });
    expect(seen).toEqual(['x']);
  });

  it('rejects duplicate plugin and tool names', () => {
    const kit = new AgentKit();
    kit.use({ name: 'p' });
    expect(() => kit.use({ name: 'p' })).toThrow(/already registered/);
    kit.use({ name: 'q', tools: [{ name: 't', description: 'A tool', run: () => 1 }] });
    expect(() => kit.use({ name: 'r', tools: [{ name: 't', description: 'Again', run: () => 1 }] })).toThrow(/already taken/);
  });
});
