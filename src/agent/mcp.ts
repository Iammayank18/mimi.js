import type { MimiRequest, MimiResponse } from '../types';
import { identifyCaller } from './caller';
import { ActionError, toProblem } from './errors';
import { readJsonBody } from './http';
import type { AgentKit, RegisteredAction } from './kit';
import { buildInstructions } from './manifest';
import { toJSONSchema, withControlFields } from './schema';
import type { CallOutcome } from './types';

/**
 * Minimal, dependency-free MCP server over Streamable HTTP (JSON responses).
 * Speaks both the stateless 2026-07-28 revision (server/discover, per-request _meta)
 * and the earlier initialize-handshake revisions, so today's clients work too.
 */
export const MCP_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];
const LATEST = MCP_VERSIONS[0];

interface RpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: any;
}

interface Tool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

function actionTool(a: RegisteredAction): Tool {
  const notes: string[] = [];
  if (a.when) notes.push(`When to use: ${a.when}`);
  if (a.effect !== 'read') notes.push(`Effect: ${a.effect}. Supports _dryRun (plan without side effects) and _idempotencyKey (safe retries).`);
  if (a.approval || a.agents === 'approval') notes.push('May return approval_required — a human must approve before it runs.');
  if (a.reversible) notes.push('Reversible: the receipt can be undone with undo_action.');
  if (a.examples?.[0]) notes.push(`Example input: ${JSON.stringify(a.examples[0].input)}`);
  return {
    name: a.name,
    title: a.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    description: [a.description, ...notes].join('\n'),
    inputSchema: withControlFields(toJSONSchema(a.input), { write: a.effect !== 'read' }),
    annotations: {
      readOnlyHint: a.effect === 'read',
      destructiveHint: a.effect === 'destructive' || a.effect === 'spend',
      idempotentHint: a.effect === 'read',
      openWorldHint: a.effect === 'external' || a.effect === 'spend',
    },
  };
}

const META_TOOLS: Record<string, Tool> = {
  find_actions: {
    name: 'find_actions',
    title: 'Find actions',
    description: 'Search this API for actions matching an intent (e.g. "refund an order"). Returns the best matches. Call describe_action next.',
    inputSchema: { type: 'object', properties: { intent: { type: 'string' }, limit: { type: 'number' } }, required: ['intent'] },
    annotations: { readOnlyHint: true },
  },
  describe_action: {
    name: 'describe_action',
    title: 'Describe action',
    description: 'Get the full input schema, effect, approval policy and examples for one action.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    annotations: { readOnlyHint: true },
  },
  run_action: {
    name: 'run_action',
    title: 'Run action',
    description: 'Run an action by name. Set dryRun to preview its effects first. Use idempotencyKey on writes.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        input: { type: 'object' },
        dryRun: { type: 'boolean' },
        idempotencyKey: { type: 'string' },
      },
      required: ['name'],
    },
  },
  check_approval: {
    name: 'check_approval',
    title: 'Check approval',
    description: 'Check whether a human approved a pending request (by approval id). Returns the result once executed.',
    inputSchema: { type: 'object', properties: { approvalId: { type: 'string' } }, required: ['approvalId'] },
    annotations: { readOnlyHint: true },
  },
  undo_action: {
    name: 'undo_action',
    title: 'Undo action',
    description: 'Reverse a previous call using its receipt id. Only for reversible actions you performed.',
    inputSchema: { type: 'object', properties: { receiptId: { type: 'string' } }, required: ['receiptId'] },
    annotations: { destructiveHint: false },
  },
};

export function listTools(kit: AgentKit): Tool[] {
  const actions = [...kit.actions.values()];
  const progressive = actions.length > kit.options.maxTools;
  const tools: Tool[] = progressive ? [META_TOOLS.find_actions, META_TOOLS.describe_action, META_TOOLS.run_action] : actions.map(actionTool);
  if (actions.some((a) => a.approval || a.agents === 'approval' || a.cost) || kit.options.budgets?.default?.spendPerDay !== undefined) {
    tools.push(META_TOOLS.check_approval);
  }
  if (actions.some((a) => a.undo)) tools.push(META_TOOLS.undo_action);
  for (const t of kit.customTools.values()) {
    const input = t.input && typeof (t.input as any).safeParse === 'function' ? toJSONSchema(t.input as any) : (t.input as Record<string, unknown>) ?? { type: 'object', properties: {} };
    tools.push({ name: t.name, ...(t.title && { title: t.title }), description: t.description, inputSchema: input, ...(t.annotations && { annotations: t.annotations }) });
  }
  return tools;
}

function textResult(payload: unknown, isError = false) {
  return {
    content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }],
    ...(payload && typeof payload === 'object' ? { structuredContent: payload as object } : {}),
    ...(isError && { isError: true }),
  };
}

function outcomeToResult(kit: AgentKit, o: CallOutcome) {
  switch (o.status) {
    case 'ok':
      return textResult({
        data: o.data,
        ...(o.receipt && { receipt: { id: o.receipt.id, undoable: o.receipt.undoable, effects: o.receipt.effects.map((e) => e.label) } }),
        ...(o.next.length && { next: o.next }),
        ...(o.replayed && { replayed: o.replayed }),
      });
    case 'dry_run':
      return textResult({ dryRun: true, plan: o.plan, howToProceed: 'Nothing changed. Call again without _dryRun to execute.' });
    case 'approval_required':
      return textResult({ status: 'approval_required', approval: { ...o.approval, statusUrl: undefined }, howToProceed: o.approval.howToProceed });
    case 'error':
      return textResult(o.problem, true);
  }
}

async function callTool(kit: AgentKit, req: MimiRequest, name: string, args: any) {
  args = args ?? {};
  switch (name) {
    case 'find_actions':
      return textResult({ results: await kit.find(String(args.intent ?? ''), Number(args.limit) || 5) });
    case 'describe_action': {
      const d = kit.describe(String(args.name));
      return d ? textResult(d) : textResult(new ActionError({ code: 'UNKNOWN_ACTION', status: 404, message: `No action "${args.name}".`, fix: 'Use find_actions first.' }).toProblem(), true);
    }
    case 'run_action': {
      const { outcome } = await kit.run(String(args.name), args.input ?? {}, { req, dryRun: !!args.dryRun, idempotencyKey: args.idempotencyKey }, 'mcp');
      return outcomeToResult(kit, outcome);
    }
    case 'check_approval': {
      const a = await kit.getApproval(String(args.approvalId));
      return a ? textResult(a) : textResult(new ActionError({ code: 'APPROVAL_NOT_FOUND', status: 404, message: 'No such approval.' }).toProblem(), true);
    }
    case 'undo_action': {
      const caller = await identifyCaller(req, 'mcp', kit.options);
      const r = await kit.getReceipt(String(args.receiptId));
      if (r && r.caller.id !== caller.id) {
        return textResult(new ActionError({ code: 'NOT_YOUR_RECEIPT', status: 403, message: 'Agents can only undo their own actions.' }).toProblem(), true);
      }
      try {
        return textResult(await kit.undo(String(args.receiptId), caller));
      } catch (err) {
        return textResult(toProblem(err), true);
      }
    }
  }
  const custom = kit.customTools.get(name);
  if (custom) {
    const caller = await identifyCaller(req, 'mcp', kit.options);
    try {
      let parsed = args;
      if (custom.input && typeof (custom.input as any).safeParse === 'function') {
        const r = (custom.input as any).safeParse(args);
        if (!r.success) {
          return textResult(new ActionError({ code: 'INVALID_INPUT', status: 422, message: `Invalid input for ${name}.`, fix: r.error.issues.map((i: any) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') }).toProblem(name), true);
        }
        parsed = r.data;
      }
      const out = await custom.run(parsed, { caller, req });
      return textResult(out ?? { ok: true });
    } catch (err) {
      return textResult(toProblem(err, name), true);
    }
  }
  if (!kit.actions.has(name) || kit.actions.size > kit.options.maxTools) return undefined;
  const { outcome } = await kit.run(name, args, { req }, 'mcp');
  return outcomeToResult(kit, outcome);
}

async function handleMessage(kit: AgentKit, req: MimiRequest, msg: RpcMessage): Promise<object | undefined> {
  const reply = (result: Record<string, unknown>) => ({ jsonrpc: '2.0', id: msg.id, result: { resultType: 'complete', ...result } });
  const error = (code: number, message: string, data?: unknown) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message, ...(data !== undefined && { data }) } });

  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return error(-32600, 'Invalid Request');
  const isNotification = msg.id === undefined;
  if (isNotification) return undefined;

  const serverInfo = { name: kit.options.name ?? 'mimi.js', version: kit.options.version ?? '1.0.0' };
  const capabilities = { tools: { listChanged: false } };

  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion;
      return reply({
        protocolVersion: MCP_VERSIONS.includes(requested) ? requested : MCP_VERSIONS[1],
        capabilities,
        serverInfo,
        instructions: buildInstructions(kit),
      });
    }
    case 'server/discover':
      return reply({ protocolVersions: MCP_VERSIONS, capabilities, serverInfo, instructions: buildInstructions(kit) });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: listTools(kit), ttlMs: 60_000, cacheScope: 'public' });
    case 'tools/call': {
      const name = msg.params?.name;
      if (typeof name !== 'string') return error(-32602, 'Missing tool name');
      const result = await callTool(kit, req, name, msg.params?.arguments);
      if (!result) return error(-32602, `Unknown tool: ${name}`);
      return reply({ ...result, _meta: { 'io.modelcontextprotocol/serverInfo': serverInfo } });
    }
    case 'resources/list':
      return reply({ resources: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
    default:
      return error(-32601, `Method not found: ${msg.method}`);
  }
}

export function createMcpHandler(kit: AgentKit) {
  return async (req: MimiRequest, res: MimiResponse) => {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      body = undefined;
    }
    const send = (status: number, payload?: unknown) => {
      res.statusCode = status;
      if (payload === undefined) return res.end();
      const text = JSON.stringify(payload);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('MCP-Protocol-Version', String(req.headers['mcp-protocol-version'] ?? LATEST));
      res.setHeader('Content-Length', Buffer.byteLength(text));
      res.end(text);
    };
    if (!body || typeof body !== 'object') return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    try {
      if (Array.isArray(body)) {
        const out = (await Promise.all(body.map((m) => handleMessage(kit, req, m)))).filter(Boolean);
        return out.length ? send(200, out) : send(202);
      }
      const out = await handleMessage(kit, req, body as RpcMessage);
      return out ? send(200, out) : send(202);
    } catch (err) {
      return send(200, { jsonrpc: '2.0', id: (body as any).id ?? null, error: { code: -32603, message: 'Internal error', data: toProblem(err) } });
    }
  };
}

export { LATEST as MCP_LATEST_VERSION };
