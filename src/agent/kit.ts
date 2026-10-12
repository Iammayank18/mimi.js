import { createHash, randomUUID } from 'crypto';
import { ActionError, toProblem } from './errors';
import { identifyCaller } from './caller';
import { describeIssues, fixSentence, toJSONSchema } from './schema';
import { rank } from './find';
import { MemoryStore } from './store';
import type {
  ActionContext,
  ActionSpec,
  AgentOptions,
  ApprovalRecord,
  BudgetRule,
  CallOptions,
  CallOutcome,
  Caller,
  Effect,
  KVStore,
  Plan,
  PlannedEffect,
  Problem,
  PublicApproval,
  Receipt,
  Suggestion,
} from './types';

export interface RegisteredAction extends ActionSpec {
  name: string;
  effect: Effect;
  method: string;
  path: string;
  reversible: boolean;
}

export interface RateInfo {
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface RunResult {
  outcome: CallOutcome;
  caller: Caller;
  rate?: RateInfo;
}

interface ActionStats {
  calls: number;
  agentCalls: number;
  humanCalls: number;
  dryRuns: number;
  approvalsRequested: number;
  errors: Record<string, number>;
  /** "path|expected|received" → count, from validation failures */
  fieldFailures: Record<string, number>;
  totalMs: number;
}

export interface ActivityEvent {
  at: string;
  action: string;
  caller: Pick<Caller, 'kind' | 'id' | 'name' | 'via'>;
  outcome: CallOutcome['status'];
  code?: string;
  ms: number;
  receiptId?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const RESERVED = ['_dryRun', '_idempotencyKey', '_approvalId'];

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(',')}}`;
}

const fingerprint = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex').slice(0, 32);

function parseHttp(spec: string | undefined, name: string, effect: Effect): { method: string; path: string } {
  if (spec) {
    const [m, p] = spec.trim().split(/\s+/);
    if (!p) return { method: effect === 'read' ? 'GET' : 'POST', path: m };
    return { method: m.toUpperCase(), path: p };
  }
  return { method: effect === 'read' ? 'GET' : 'POST', path: `/actions/${name}` };
}

/**
 * The agent-native runtime. Holds the action registry and runs every call through
 * the same contract — validation, policy, budgets, idempotency, approval, dry-run,
 * receipts — no matter whether it arrived over REST, MCP, or in-process.
 */
export class AgentKit {
  readonly actions = new Map<string, RegisteredAction>();
  readonly options: Required<Pick<AgentOptions, 'basePath' | 'maxTools' | 'autoDedupeMs' | 'idempotencyTtlMs' | 'approvalTtlMs' | 'undoWindowMs'>> &
    AgentOptions;
  readonly store: KVStore;
  private stats = new Map<string, ActionStats>();
  private activityLog: ActivityEvent[] = [];
  private approvalIds: string[] = [];
  /** Called after an action is registered (used by the HTTP layer to mount routes). */
  onRegister?: (action: RegisteredAction) => void;

  constructor(options: AgentOptions = {}) {
    this.options = {
      basePath: '/_agent',
      maxTools: 24,
      autoDedupeMs: 10_000,
      idempotencyTtlMs: DAY,
      approvalTtlMs: 60 * 60 * 1000,
      undoWindowMs: DAY,
      ...options,
    };
    this.store = options.store ?? new MemoryStore();
  }

  // ───────────────────────────── registry ─────────────────────────────

  action<I = any, O = any>(name: string, spec: ActionSpec<I, O>): this {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) {
      throw new Error(`Action name "${name}" must be alphanumeric/underscore (it becomes an MCP tool name).`);
    }
    if (this.actions.has(name)) throw new Error(`Action "${name}" is already defined.`);
    if (!spec.description || spec.description.length < 10) {
      throw new Error(`Action "${name}" needs a real description — agents choose tools by reading it.`);
    }
    const effect = spec.effect ?? 'read';
    const { method, path } = parseHttp(spec.http, name, effect);
    const registered: RegisteredAction = {
      ...(spec as ActionSpec),
      name,
      effect,
      method,
      path,
      reversible: spec.reversible ?? typeof spec.undo === 'function',
    };
    this.actions.set(name, registered);
    this.onRegister?.(registered);
    return this;
  }

  // ───────────────────────────── calling ─────────────────────────────

  /** Call an action in-process with the full agent contract. */
  async call(name: string, input: unknown, opts: CallOptions = {}): Promise<CallOutcome> {
    return (await this.run(name, input, { ...opts }, 'internal')).outcome;
  }

  /** @internal — transport-aware entry point used by REST and MCP. */
  async run(name: string, rawInput: unknown, opts: CallOptions, via: Caller['via']): Promise<RunResult> {
    const started = Date.now();
    const caller = await identifyCaller(opts.req, via, this.options, opts.caller);
    const action = this.actions.get(name);
    if (!action) {
      const near = this.find(name, 3).map((r) => ({ action: r.name, why: r.description }));
      const problem = new ActionError({
        code: 'UNKNOWN_ACTION',
        status: 404,
        message: `No action named "${name}".`,
        fix: near.length ? `Did you mean ${near.map((n) => `\`${n.action}\``).join(' or ')}?` : 'List actions via the manifest or find endpoint.',
        suggest: near,
      }).toProblem();
      return { outcome: { status: 'error', problem }, caller };
    }

    const result = await this.execute(action, rawInput, opts, caller);
    this.record(action, caller, result.outcome, Date.now() - started);
    return result;
  }

  private async execute(action: RegisteredAction, rawInput: unknown, opts: CallOptions, caller: Caller, bypassApproval = false): Promise<RunResult> {
    const fail = (p: Problem): RunResult => ({ outcome: { status: 'error', problem: p }, caller });

    // 1. Policy — who may call
    if (caller.kind === 'agent' && action.agents === 'deny') {
      return fail(
        new ActionError({
          code: 'AGENTS_NOT_ALLOWED',
          status: 403,
          message: `"${action.name}" can only be performed by a human.`,
          fix: 'Do not retry. Ask the user to do this themselves in the product UI.',
        }).toProblem(action.name),
      );
    }

    // 2. Input — strip control fields, coerce, validate
    const input0 = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? { ...(rawInput as Record<string, unknown>) } : rawInput ?? {};
    let dryRun = !!opts.dryRun;
    let idemKey = opts.idempotencyKey;
    if (input0 && typeof input0 === 'object') {
      const o = input0 as Record<string, unknown>;
      if (o._dryRun === true || o._dryRun === 'true') dryRun = true;
      if (typeof o._idempotencyKey === 'string') idemKey = o._idempotencyKey;
      for (const k of RESERVED) delete o[k];
    }
    const coerced = input0;
    let input: unknown = coerced;
    if (action.input) {
      const parsed = action.input.safeParse(coerced);
      if (!parsed.success) {
        const issues = describeIssues(parsed.error.issues, coerced);
        this.noteFieldFailures(action.name, issues);
        const err = new ActionError({
          code: 'INVALID_INPUT',
          status: 422,
          message: `Input for "${action.name}" is invalid (${issues.length} problem${issues.length > 1 ? 's' : ''}).`,
          fix: fixSentence(issues),
          param: issues[0]?.path,
        });
        err.extra = { issues, ...(action.examples?.[0] && { example: action.examples[0].input }) };
        return fail(err.toProblem(action.name));
      }
      input = parsed.data;
    }

    // 3. Rate budget (agents only)
    const rule = this.budgetFor(caller);
    let rate: RateInfo | undefined;
    if (caller.kind === 'agent' && rule?.requestsPerMinute) {
      rate = await this.hitRate(caller.id, rule.requestsPerMinute);
      if (rate.remaining < 0) {
        rate.remaining = 0;
        const p = new ActionError({
          code: 'RATE_LIMITED',
          status: 429,
          message: `Agent "${caller.id}" exceeded ${rule.requestsPerMinute} calls/minute.`,
          retriable: true,
          retryAfter: rate.resetSeconds,
          fix: `Wait ${rate.resetSeconds}s, then retry. Batch work or use find/describe to avoid exploratory calls.`,
        }).toProblem(action.name);
        return { ...fail(p), rate };
      }
    }

    const cost = typeof action.cost === 'function' ? Number(action.cost(input as any)) || 0 : action.cost ?? 0;

    // 4. Approval reasons (computed for both plans and real calls)
    let approvalReason: string | false = false;
    if (!bypassApproval) {
      if (caller.kind === 'agent' && action.agents === 'approval') approvalReason = 'Agent calls to this action always need human approval.';
      if (!approvalReason && action.approval !== undefined) {
        const a = typeof action.approval === 'function' ? await action.approval(input as any, { caller }) : action.approval;
        if (a) approvalReason = typeof a === 'string' ? a : 'This action requires human approval.';
      }
      if (!approvalReason && caller.kind === 'agent' && cost > 0 && rule?.spendPerDay !== undefined) {
        const spent = await this.spentToday(caller.id);
        if (spent + cost > rule.spendPerDay) {
          approvalReason = `Over the agent's daily budget (${spent} of ${rule.spendPerDay} used, this call costs ${cost}).`;
        }
      }
    }

    // 5. Dry run → plan, no side effects
    if (dryRun) {
      const planned = await this.plan(action, input, caller, cost, approvalReason, opts);
      if ('problem' in planned) return { ...fail(planned.problem), rate };
      return { outcome: { status: 'dry_run', plan: planned.plan }, caller, rate };
    }

    // 6. Reads run straight through
    if (action.effect === 'read') {
      return { ...(await this.perform(action, input, caller, opts, cost)), rate };
    }

    // 7. Idempotency (explicit key, or auto-dedupe for agents)
    let lockKey: string | undefined;
    let lockTtl = this.options.idempotencyTtlMs;
    let replayKind: 'idempotency-key' | 'auto-dedupe' = 'idempotency-key';
    if (bypassApproval) {
      // An approved call is executed exactly once by approve(); it must not replay the parked outcome.
    } else if (idemKey) {
      lockKey = `idem:${caller.id}:${action.name}:${idemKey}`;
    } else if (caller.kind === 'agent' && this.options.autoDedupeMs > 0) {
      lockKey = `auto:${caller.id}:${action.name}:${fingerprint(input)}`;
      lockTtl = this.options.autoDedupeMs;
      replayKind = 'auto-dedupe';
    }
    const fp = fingerprint(input);
    if (lockKey) {
      const acquired = await this.store.setIfAbsent(lockKey, { state: 'running', fp }, lockTtl);
      if (!acquired) {
        const prev = await this.store.get<{ state: string; fp: string; outcome?: CallOutcome }>(lockKey);
        if (prev && prev.fp !== fp) {
          return fail(
            new ActionError({
              code: 'IDEMPOTENCY_KEY_REUSED',
              status: 422,
              message: 'This idempotency key was already used with a different input.',
              fix: 'Generate a new idempotency key for a new intent; reuse a key only to retry the exact same call.',
            }).toProblem(action.name),
          );
        }
        if (prev?.state === 'done' && prev.outcome) {
          const o = prev.outcome;
          return { outcome: o.status === 'ok' ? { ...o, replayed: replayKind } : o, caller, rate };
        }
        return fail(
          new ActionError({
            code: 'IN_PROGRESS',
            status: 409,
            message: 'An identical call is still running.',
            retriable: true,
            retryAfter: 1,
            fix: 'Wait a second and retry with the same idempotency key to get its result.',
          }).toProblem(action.name),
        );
      }
    }

    const release = async (outcome: CallOutcome) => {
      if (!lockKey) return;
      if (outcome.status === 'error' && outcome.problem.retriable) await this.store.delete(lockKey);
      else await this.store.set(lockKey, { state: 'done', fp, outcome }, lockTtl);
    };

    // 8. Approval gate — park the exact planned call for a human
    if (approvalReason) {
      const planned = await this.plan(action, input, caller, cost, approvalReason, opts);
      if ('problem' in planned) {
        await release({ status: 'error', problem: planned.problem });
        return { ...fail(planned.problem), rate };
      }
      const approval = await this.createApproval(action, input, caller, approvalReason, planned.plan);
      const outcome: CallOutcome = { status: 'approval_required', approval };
      await release(outcome);
      return { outcome, caller, rate };
    }

    // 9. Execute
    const res = await this.perform(action, input, caller, opts, cost);
    await release(res.outcome);
    return { ...res, rate };
  }

  private makeContext(caller: Caller, dryRun: boolean, opts: CallOptions): ActionContext & { effects: PlannedEffect[] } {
    const effects: PlannedEffect[] = [];
    return {
      caller,
      dryRun,
      req: opts.req,
      effects,
      async effect<T>(label: string, fn: () => T | Promise<T>, preview?: T): Promise<T> {
        if (dryRun) {
          effects.push({ label, executed: false });
          return preview as T;
        }
        const v = await fn();
        effects.push({ label, executed: true });
        return v;
      },
      fail(code, details = {}) {
        throw new ActionError({ code, ...details });
      },
    };
  }

  private async plan(
    action: RegisteredAction,
    input: unknown,
    caller: Caller,
    cost: number,
    approvalRequired: string | false,
    opts: CallOptions,
  ): Promise<{ plan: Plan } | { problem: Problem }> {
    const ctx = this.makeContext(caller, true, opts);
    try {
      const wouldReturn = await action.run(input as any, ctx);
      return {
        plan: {
          action: action.name,
          effect: action.effect,
          effects: ctx.effects,
          cost,
          reversible: action.reversible,
          approvalRequired,
          wouldReturn,
        },
      };
    } catch (err) {
      return { problem: toProblem(err, action.name) };
    }
  }

  private async perform(action: RegisteredAction, input: unknown, caller: Caller, opts: CallOptions, cost: number): Promise<RunResult> {
    const ctx = this.makeContext(caller, false, opts);
    try {
      const data = await action.run(input as any, ctx);
      let receipt: Receipt | undefined;
      if (action.effect !== 'read') {
        receipt = {
          id: `rcpt_${randomUUID().replace(/-/g, '')}`,
          action: action.name,
          input,
          output: data,
          caller,
          effects: ctx.effects,
          cost,
          at: new Date().toISOString(),
          undoable: typeof action.undo === 'function',
        };
        await this.store.set(`receipt:${receipt.id}`, receipt, Math.max(this.options.undoWindowMs, 7 * DAY));
        if (caller.kind === 'agent' && cost > 0) await this.addSpend(caller.id, cost);
      }
      let next: Suggestion[] = [];
      try {
        next = action.next?.(data as any, input as any) ?? [];
      } catch {
        next = [];
      }
      return { outcome: { status: 'ok', data, receipt, next }, caller };
    } catch (err) {
      return { outcome: { status: 'error', problem: toProblem(err, action.name) }, caller };
    }
  }

  // ───────────────────────────── approvals ─────────────────────────────

  private publicApproval(r: ApprovalRecord): PublicApproval {
    return {
      id: r.id,
      reason: r.reason,
      status: r.status,
      plan: r.plan,
      expiresAt: r.expiresAt,
      statusUrl: `${this.options.basePath}/approvals/${r.id}`,
      howToProceed:
        r.status === 'pending'
          ? 'A human must approve this exact call. Tell the user what is waiting and why, then poll statusUrl (or the check_approval tool). Do not resubmit.'
          : r.status === 'executed'
            ? 'Approved and executed. The result is in `result`.'
            : `This request is ${r.status}. Do not retry automatically.`,
    };
  }

  private async createApproval(action: RegisteredAction, input: unknown, caller: Caller, reason: string, plan: Plan): Promise<PublicApproval> {
    const now = Date.now();
    const rec: ApprovalRecord = {
      id: `apr_${randomUUID().replace(/-/g, '')}`,
      action: action.name,
      input,
      caller,
      reason,
      plan,
      status: 'pending',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.options.approvalTtlMs).toISOString(),
    };
    await this.store.set(`approval:${rec.id}`, rec, this.options.approvalTtlMs + DAY);
    this.approvalIds.push(rec.id);
    if (this.approvalIds.length > 1000) this.approvalIds.shift();
    this.bump(action.name).approvalsRequested++;
    try {
      await this.options.onApprovalRequested?.(rec);
    } catch {
      /* notification failures must not break the call */
    }
    return this.publicApproval(rec);
  }

  async getApproval(id: string): Promise<(PublicApproval & { result?: unknown; receiptId?: string; error?: unknown }) | undefined> {
    const rec = await this.store.get<ApprovalRecord>(`approval:${id}`);
    if (!rec) return undefined;
    if (rec.status === 'pending' && Date.parse(rec.expiresAt) < Date.now()) {
      rec.status = 'expired';
      await this.store.set(`approval:${id}`, rec, DAY);
    }
    return { ...this.publicApproval(rec), ...(rec.result !== undefined && { result: rec.result }), ...(rec.receiptId && { receiptId: rec.receiptId }), ...(rec.error !== undefined && { error: rec.error }) };
  }

  async listApprovals(status?: ApprovalRecord['status']): Promise<ApprovalRecord[]> {
    const out: ApprovalRecord[] = [];
    for (const id of [...this.approvalIds].reverse()) {
      const r = await this.store.get<ApprovalRecord>(`approval:${id}`);
      if (r && (!status || r.status === status)) out.push(r);
    }
    return out;
  }

  /** Approve a pending call. The exact stored input is executed — the agent cannot change it afterwards. */
  async approve(id: string, by = 'admin') {
    const rec = await this.store.get<ApprovalRecord>(`approval:${id}`);
    if (!rec) throw new ActionError({ code: 'APPROVAL_NOT_FOUND', status: 404, message: 'No such approval.' });
    if (rec.status !== 'pending') throw new ActionError({ code: 'APPROVAL_NOT_PENDING', status: 409, message: `Approval is already ${rec.status}.` });
    if (Date.parse(rec.expiresAt) < Date.now()) {
      rec.status = 'expired';
      await this.store.set(`approval:${id}`, rec, DAY);
      throw new ActionError({ code: 'APPROVAL_EXPIRED', status: 409, message: 'Approval expired.' });
    }
    rec.status = 'approved';
    rec.decidedBy = by;
    rec.decidedAt = new Date().toISOString();
    await this.store.set(`approval:${id}`, rec, DAY);

    const action = this.actions.get(rec.action)!;
    const started = Date.now();
    const { outcome } = await this.execute(action, rec.input, {}, rec.caller, true);
    this.record(action, rec.caller, outcome, Date.now() - started);
    if (outcome.status === 'ok') {
      rec.status = 'executed';
      rec.result = outcome.data;
      rec.receiptId = outcome.receipt?.id;
    } else {
      rec.status = 'failed';
      rec.error = outcome.status === 'error' ? outcome.problem : outcome;
    }
    await this.store.set(`approval:${id}`, rec, DAY);
    return this.getApproval(id);
  }

  async reject(id: string, by = 'admin', note?: string) {
    const rec = await this.store.get<ApprovalRecord>(`approval:${id}`);
    if (!rec) throw new ActionError({ code: 'APPROVAL_NOT_FOUND', status: 404, message: 'No such approval.' });
    if (rec.status !== 'pending') throw new ActionError({ code: 'APPROVAL_NOT_PENDING', status: 409, message: `Approval is already ${rec.status}.` });
    rec.status = 'rejected';
    rec.decidedBy = by;
    rec.decidedAt = new Date().toISOString();
    if (note) rec.error = { note };
    await this.store.set(`approval:${id}`, rec, DAY);
    return this.getApproval(id);
  }

  // ───────────────────────────── receipts / undo ─────────────────────────────

  async getReceipt(id: string): Promise<Receipt | undefined> {
    return this.store.get<Receipt>(`receipt:${id}`);
  }

  async undo(id: string, by: Caller): Promise<{ undone: true; receipt: Receipt; result: unknown }> {
    const r = await this.getReceipt(id);
    if (!r) throw new ActionError({ code: 'RECEIPT_NOT_FOUND', status: 404, message: 'No such receipt.' });
    const action = this.actions.get(r.action);
    if (!action?.undo) {
      throw new ActionError({ code: 'NOT_UNDOABLE', status: 409, message: `"${r.action}" cannot be undone automatically.`, fix: 'Tell the user this needs a manual fix.' });
    }
    if (r.undone) throw new ActionError({ code: 'ALREADY_UNDONE', status: 409, message: `Already undone at ${r.undone.at}.` });
    if (Date.now() - Date.parse(r.at) > this.options.undoWindowMs) {
      throw new ActionError({ code: 'UNDO_WINDOW_CLOSED', status: 409, message: 'The undo window for this receipt has closed.' });
    }
    const ctx = this.makeContext(by, false, {});
    const result = await action.undo(r.input as any, r.output as any, ctx);
    r.undone = { at: new Date().toISOString(), by: `${by.kind}:${by.id}` };
    await this.store.set(`receipt:${id}`, r, 7 * DAY);
    if (r.caller.kind === 'agent' && r.cost > 0) await this.addSpend(r.caller.id, -r.cost);
    this.log({ at: r.undone.at, action: `${r.action}.undo`, caller: by, outcome: 'ok', ms: 0, receiptId: id });
    return { undone: true, receipt: r, result };
  }

  // ───────────────────────────── budgets ─────────────────────────────

  private budgetFor(caller: Caller): BudgetRule | undefined {
    const b = this.options.budgets;
    if (!b) return undefined;
    return { ...b.default, ...b.perAgent?.[caller.id] };
  }

  private async hitRate(id: string, limit: number): Promise<RateInfo> {
    const key = `rate:${id}`;
    const now = Date.now();
    const hits = ((await this.store.get<number[]>(key)) ?? []).filter((t) => now - t < 60_000);
    hits.push(now);
    await this.store.set(key, hits, 60_000);
    return { limit, remaining: limit - hits.length, resetSeconds: Math.max(1, Math.ceil((hits[0] + 60_000 - now) / 1000)) };
  }

  async spentToday(id: string): Promise<number> {
    const now = Date.now();
    const entries = ((await this.store.get<Array<[number, number]>>(`spend:${id}`)) ?? []).filter(([t]) => now - t < DAY);
    return entries.reduce((s, [, a]) => s + a, 0);
  }

  private async addSpend(id: string, amount: number) {
    const now = Date.now();
    const entries = ((await this.store.get<Array<[number, number]>>(`spend:${id}`)) ?? []).filter(([t]) => now - t < DAY);
    entries.push([now, amount]);
    await this.store.set(`spend:${id}`, entries, DAY);
  }

  // ───────────────────────────── discovery ─────────────────────────────

  find(query: string, limit = 5) {
    const docs = [...this.actions.values()].map((a) => ({
      id: a.name,
      text: [a.name, a.name, a.description, a.when ?? '', (a.tags ?? []).join(' '), Object.keys(toJSONSchema(a.input).properties ?? {}).join(' ')].join(' '),
    }));
    return rank(query, docs, limit).map((r) => {
      const a = this.actions.get(r.id)!;
      return { name: a.name, score: r.score, description: a.description, effect: a.effect, http: `${a.method} ${a.path}` };
    });
  }

  describe(name: string) {
    const a = this.actions.get(name);
    if (!a) return undefined;
    return {
      name: a.name,
      description: a.description,
      ...(a.when && { when: a.when }),
      effect: a.effect,
      reversible: a.reversible,
      approval: a.approval ? (typeof a.approval === 'function' ? 'conditional' : 'always') : a.agents === 'approval' ? 'agents' : 'never',
      agents: a.agents ?? 'allow',
      http: { method: a.method, path: a.path },
      input: toJSONSchema(a.input),
      ...(a.output && { output: toJSONSchema(a.output) }),
      ...(a.examples?.length && { examples: a.examples }),
      ...(a.tags?.length && { tags: a.tags }),
    };
  }

  // ───────────────────────────── observability ─────────────────────────────

  private bump(name: string): ActionStats {
    let s = this.stats.get(name);
    if (!s) {
      s = { calls: 0, agentCalls: 0, humanCalls: 0, dryRuns: 0, approvalsRequested: 0, errors: {}, fieldFailures: {}, totalMs: 0 };
      this.stats.set(name, s);
    }
    return s;
  }

  private noteFieldFailures(name: string, issues: Array<{ path: string; expected?: string; received?: string }>) {
    const s = this.bump(name);
    for (const i of issues) {
      const k = `${i.path}|${i.expected ?? '?'}|${i.received ?? '?'}`;
      s.fieldFailures[k] = (s.fieldFailures[k] ?? 0) + 1;
    }
  }

  private record(action: RegisteredAction, caller: Caller, outcome: CallOutcome, ms: number) {
    const s = this.bump(action.name);
    s.calls++;
    s.totalMs += ms;
    if (caller.kind === 'agent') s.agentCalls++;
    else s.humanCalls++;
    if (outcome.status === 'dry_run') s.dryRuns++;
    if (outcome.status === 'error') s.errors[outcome.problem.code] = (s.errors[outcome.problem.code] ?? 0) + 1;
    this.log({
      at: new Date().toISOString(),
      action: action.name,
      caller: { kind: caller.kind, id: caller.id, name: caller.name, via: caller.via },
      outcome: outcome.status,
      ...(outcome.status === 'error' && { code: outcome.problem.code }),
      ...(outcome.status === 'ok' && outcome.receipt && { receiptId: outcome.receipt.id }),
      ms,
    });
  }

  private log(e: ActivityEvent) {
    this.activityLog.push(e);
    if (this.activityLog.length > 1000) this.activityLog.shift();
  }

  activity(filter: { agent?: string; action?: string; limit?: number } = {}): ActivityEvent[] {
    return this.activityLog
      .filter((e) => (!filter.agent || e.caller.id === filter.agent) && (!filter.action || e.action === filter.action))
      .slice(-(filter.limit ?? 100))
      .reverse();
  }

  /**
   * Agent-DX analytics: where do agents struggle with this API, and what should change?
   * Turns failure patterns into concrete suggestions for the API author.
   */
  insights() {
    const actions = [...this.stats.entries()].map(([name, s]) => {
      const errorTotal = Object.values(s.errors).reduce((a, b) => a + b, 0);
      const hints: string[] = [];
      const a = this.actions.get(name);
      for (const [k, n] of Object.entries(s.fieldFailures).sort((x, y) => y[1] - x[1]).slice(0, 3)) {
        const [path, expected, received] = k.split('|');
        if (n < 2) continue;
        if (received === 'missing') hints.push(`Agents omitted \`${path}\` ${n}×. Make it optional with a default, or say in the description why it is required.`);
        else hints.push(`Agents sent \`${path}\` as ${received} instead of ${expected} ${n}×. Accept ${received} (e.g. z.coerce) or add an example.`);
      }
      if (s.agentCalls >= 5 && (s.errors.INVALID_INPUT ?? 0) / s.agentCalls > 0.3 && !a?.examples?.length) {
        hints.push('Over 30% of agent calls fail validation. Add `examples` — they measurably improve tool-call accuracy.');
      }
      if (a && !a.when && s.agentCalls > 0) hints.push('Add a `when` field so agents know when to pick this action over similar ones.');
      if (a && a.effect !== 'read' && !a.undo) hints.push('No `undo` handler — agent mistakes here need manual cleanup.');
      return {
        action: name,
        calls: s.calls,
        agentCalls: s.agentCalls,
        humanCalls: s.humanCalls,
        dryRuns: s.dryRuns,
        approvalsRequested: s.approvalsRequested,
        errorRate: s.calls ? Math.round((errorTotal / s.calls) * 1000) / 1000 : 0,
        errors: s.errors,
        avgMs: s.calls ? Math.round(s.totalMs / s.calls) : 0,
        hints,
      };
    });
    const unused = [...this.actions.keys()].filter((n) => !this.stats.get(n)?.calls);
    return { actions: actions.sort((x, y) => y.calls - x.calls), unused };
  }
}
