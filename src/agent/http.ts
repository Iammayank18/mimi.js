import type { MimiApp, MimiRequest, MimiResponse } from '../types';
import { ActionError, toProblem } from './errors';
import { identifyCaller } from './caller';
import type { AgentKit, RegisteredAction, RunResult } from './kit';
import { buildLlmsTxt, buildManifest } from './manifest';
import { coerceBySchema, toJSONSchema } from './schema';
import type { Problem } from './types';

const MAX_BODY = 1024 * 1024;

/** Parse a JSON body if no body parser has run yet. Never throws on empty bodies. */
export async function readJsonBody(req: MimiRequest): Promise<unknown> {
  if (req.body !== undefined) return req.body;
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as any as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new ActionError({ code: 'BODY_TOO_LARGE', status: 413, message: 'Request body exceeds 1 MB.' });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return (req.body = undefined);
  try {
    req.body = JSON.parse(raw);
    return req.body;
  } catch {
    throw new ActionError({ code: 'INVALID_JSON', status: 400, message: 'Request body is not valid JSON.', fix: 'Send a JSON object with Content-Type: application/json.' });
  }
}

export function origin(req: MimiRequest): string {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) ?? ((req.socket as any)?.encrypted ? 'https' : 'http');
  return host ? `${proto}://${host}` : '';
}

function sendJson(res: MimiResponse, status: number, body: unknown, type = 'application/json; charset=utf-8') {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
}

export function sendProblem(res: MimiResponse, p: Problem) {
  if (p.retryAfter !== undefined) res.setHeader('Retry-After', String(p.retryAfter));
  sendJson(res, p.status, p, 'application/problem+json; charset=utf-8');
}

function truthy(v: unknown) {
  return v === true || v === 'true' || v === '1' || v === '';
}

function wantsEnvelope(req: MimiRequest, kind: string) {
  const accept = String(req.headers.accept ?? '');
  if (accept.includes('application/vnd.mimi.agent+json')) return true;
  if (accept.includes('application/vnd.mimi.plain+json')) return false;
  return kind === 'agent';
}

/** Write a call outcome to an HTTP response — the same contract REST clients and agents read. */
export function writeOutcome(req: MimiRequest, res: MimiResponse, kit: AgentKit, result: RunResult, actionName = '') {
  const { outcome, caller, rate } = result;
  const custom = kit.options.formatResponse?.(outcome, { caller, req, action: actionName });
  if (custom) {
    for (const [k, v] of Object.entries(custom.headers ?? {})) res.setHeader(k, v);
    return sendJson(res, custom.status ?? 200, custom.body);
  }
  if (rate) {
    res.setHeader('RateLimit-Limit', String(rate.limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, rate.remaining)));
    res.setHeader('RateLimit-Reset', String(rate.resetSeconds));
  }
  res.setHeader('X-Caller-Kind', caller.kind);
  switch (outcome.status) {
    case 'error':
      return sendProblem(res, outcome.problem);
    case 'dry_run':
      res.setHeader('Preference-Applied', 'dry-run');
      return sendJson(res, 200, { dryRun: true, plan: outcome.plan, howToProceed: 'Nothing was changed. Repeat the call without dryRun to execute it.' });
    case 'approval_required':
      res.setHeader('Location', outcome.approval.statusUrl);
      return sendJson(res, 202, { status: 'approval_required', approval: outcome.approval });
    case 'ok': {
      if (outcome.replayed) res.setHeader('Idempotent-Replayed', outcome.replayed);
      const receipt = outcome.receipt && {
        id: outcome.receipt.id,
        undoable: outcome.receipt.undoable,
        ...(outcome.receipt.undoable && { undoUrl: `${kit.options.basePath}/receipts/${outcome.receipt.id}/undo` }),
        effects: outcome.receipt.effects.map((e) => e.label),
      };
      if (receipt) res.setHeader('X-Receipt-Id', receipt.id);
      if (wantsEnvelope(req, caller.kind)) {
        return sendJson(res, 200, { data: outcome.data, ...(receipt && { receipt }), ...(outcome.next.length && { next: outcome.next }), ...(outcome.replayed && { replayed: outcome.replayed }) });
      }
      return sendJson(res, 200, outcome.data ?? null);
    }
  }
}

function header(req: MimiRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Mount one action as a REST route. */
export function mountAction(app: MimiApp, kit: AgentKit, action: RegisteredAction) {
  const method = action.method.toLowerCase();
  const handler = async (req: MimiRequest, res: MimiResponse) => {
    try {
      const body = await readJsonBody(req);
      const query: Record<string, unknown> = { ...(req.query ?? {}) };
      const dryRun =
        truthy(query.dryRun) || truthy(query.dry_run) || truthy(header(req, 'x-dry-run')) || /dry-run/.test(header(req, 'prefer') ?? '');
      delete query.dryRun;
      delete query.dry_run;
      // Query strings and path params are always strings: coerce them by schema.
      // JSON bodies are passed through untouched so type mistakes stay visible.
      const json = toJSONSchema(action.input);
      const input = {
        ...coerceBySchema(query, json),
        ...(body && typeof body === 'object' && !Array.isArray(body) ? (body as object) : {}),
        ...coerceBySchema({ ...(req.params ?? {}) }, json),
      };
      const result = await kit.run(action.name, input, { req, dryRun, idempotencyKey: header(req, 'idempotency-key') }, 'http');
      writeOutcome(req, res, kit, result, action.name);
    } catch (err) {
      sendProblem(res, toProblem(err, action.name));
    }
  };
  if (typeof (app as any)[method] !== 'function') throw new Error(`Unsupported HTTP method ${action.method} for action ${action.name}`);
  (app as any)[method](action.path, handler);
}

async function isAdmin(kit: AgentKit, req: MimiRequest): Promise<boolean> {
  const o = kit.options;
  if (o.authorizeAdmin) return !!(await o.authorizeAdmin(req));
  if (o.adminKey) return header(req, 'x-admin-key') === o.adminKey;
  return process.env.NODE_ENV !== 'production';
}

const forbidden = () =>
  new ActionError({
    code: 'ADMIN_ONLY',
    status: 403,
    message: 'This endpoint is for human operators.',
    fix: 'Agents cannot approve their own requests. Ask the user to approve it.',
  }).toProblem();

/** Discovery + human-in-the-loop + audit endpoints. */
export function mountSystemRoutes(app: MimiApp, kit: AgentKit) {
  const base = kit.options.basePath;
  const wrap = (fn: (req: MimiRequest, res: MimiResponse) => Promise<void> | void) => async (req: MimiRequest, res: MimiResponse) => {
    try {
      await fn(req, res);
    } catch (err) {
      sendProblem(res, toProblem(err));
    }
  };
  const admin = (fn: (req: MimiRequest, res: MimiResponse) => Promise<void> | void) =>
    wrap(async (req, res) => {
      if (!(await isAdmin(kit, req))) return sendProblem(res, forbidden());
      await fn(req, res);
    });

  app.get('/.well-known/agent.json', wrap((req, res) => sendJson(res, 200, buildManifest(kit, origin(req)))));
  app.get(`${base}/manifest`, wrap((req, res) => sendJson(res, 200, buildManifest(kit, origin(req)))));
  app.get(
    '/llms.txt',
    wrap((req, res) => {
      const txt = buildLlmsTxt(kit, origin(req));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.end(txt);
    }),
  );

  app.get(
    `${base}/find`,
    wrap(async (req, res) => {
      const q = String(req.query.q ?? '');
      if (!q) return sendProblem(res, new ActionError({ code: 'MISSING_QUERY', status: 400, message: 'Pass ?q=<what you want to do>.', param: 'q' }).toProblem());
      sendJson(res, 200, { query: q, results: await kit.find(q, Math.min(20, Number(req.query.limit) || 5)) });
    }),
  );

  app.get(
    `${base}/actions/:name`,
    wrap((req, res) => {
      const d = kit.describe(req.params.name);
      if (!d) return sendProblem(res, new ActionError({ code: 'UNKNOWN_ACTION', status: 404, message: `No action named "${req.params.name}".` }).toProblem());
      sendJson(res, 200, d);
    }),
  );

  // Approvals — agents poll by id, humans decide.
  app.get(
    `${base}/approvals`,
    admin(async (req, res) => sendJson(res, 200, { approvals: await kit.listApprovals((req.query.status as any) || undefined) })),
  );
  app.get(
    `${base}/approvals/:id`,
    wrap(async (req, res) => {
      const a = await kit.getApproval(req.params.id);
      if (!a) return sendProblem(res, new ActionError({ code: 'APPROVAL_NOT_FOUND', status: 404, message: 'No such approval.' }).toProblem());
      sendJson(res, 200, a);
    }),
  );
  app.post(
    `${base}/approvals/:id/approve`,
    admin(async (req, res) => {
      await readJsonBody(req).catch(() => undefined);
      sendJson(res, 200, await kit.approve(req.params.id, header(req, 'x-approver') ?? 'admin'));
    }),
  );
  app.post(
    `${base}/approvals/:id/reject`,
    admin(async (req, res) => {
      const body = (await readJsonBody(req).catch(() => undefined)) as any;
      sendJson(res, 200, await kit.reject(req.params.id, header(req, 'x-approver') ?? 'admin', body?.note));
    }),
  );

  // Receipts & undo
  app.get(
    `${base}/receipts/:id`,
    wrap(async (req, res) => {
      const r = await kit.getReceipt(req.params.id);
      if (!r) return sendProblem(res, new ActionError({ code: 'RECEIPT_NOT_FOUND', status: 404, message: 'No such receipt.' }).toProblem());
      sendJson(res, 200, r);
    }),
  );
  app.post(
    `${base}/receipts/:id/undo`,
    wrap(async (req, res) => {
      const caller = await identifyCaller(req, 'http', kit.options);
      const r = await kit.getReceipt(req.params.id);
      if (r && !(r.caller.id === caller.id || (await isAdmin(kit, req)))) return sendProblem(res, forbidden());
      sendJson(res, 200, await kit.undo(req.params.id, caller));
    }),
  );

  // Audit + agent-DX analytics
  app.get(
    `${base}/activity`,
    admin((req, res) =>
      sendJson(res, 200, { events: kit.activity({ agent: req.query.agent as string, action: req.query.action as string, limit: Number(req.query.limit) || 100 }) }),
    ),
  );
  app.get(`${base}/insights`, admin((_req, res) => sendJson(res, 200, kit.insights())));
}
