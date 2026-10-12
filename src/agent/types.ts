import type { MimiRequest } from '../types';

/**
 * What an action does to the world. This single field drives safety defaults:
 * idempotency, dry-run plans, approval gates, MCP tool hints and budgets.
 *
 * - `read`        — no side effects (safe to retry, cacheable)
 * - `write`       — creates or changes data you own
 * - `destructive` — deletes or overwrites data
 * - `spend`       — moves money or consumes a paid resource
 * - `external`    — talks to the outside world (sends email, posts to Slack, calls a webhook)
 */
export type Effect = 'read' | 'write' | 'destructive' | 'spend' | 'external';

export type CallerKind = 'human' | 'agent';

export interface Caller {
  kind: CallerKind;
  /** Stable identifier — agent id, API key id, or `anonymous`. */
  id: string;
  /** Human-readable name if known (e.g. "Claude", "ChatGPT"). */
  name?: string;
  /** How the call arrived. */
  via: 'http' | 'mcp' | 'internal';
  /** True when identity was cryptographically or otherwise verified by your `identify` hook. */
  verified: boolean;
}

/** Minimal schema contract — satisfied by Zod v4 (and v3 via zod-to-json-schema). */
export interface SchemaLike<T = unknown> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: SchemaIssue[] } };
  toJSONSchema?: (opts?: Record<string, unknown>) => Record<string, unknown>;
}

export interface SchemaIssue {
  path: PropertyKey[];
  message: string;
  code?: string;
  expected?: string;
  [k: string]: unknown;
}

export interface Suggestion {
  /** Name of an action the caller can invoke next. */
  action: string;
  /** Pre-filled input for that action. */
  input?: Record<string, unknown>;
  /** One line explaining why — agents read this. */
  why?: string;
}

export interface PlannedEffect {
  /** Human-readable description of the side effect, e.g. "Refund $40 to card •••4242". */
  label: string;
  /** Whether it actually ran (false in dry-run). */
  executed: boolean;
}

export interface ActionContext {
  /** Who is calling. */
  caller: Caller;
  /** True when the caller asked for a plan only. Side effects wrapped in `ctx.effect()` are skipped. */
  dryRun: boolean;
  /** The raw HTTP request when the call came over HTTP/MCP. Undefined for in-process calls. */
  req?: MimiRequest;
  /**
   * Declare a side-effect boundary. In a real call `fn` runs and its value is returned.
   * In a dry run `fn` is skipped, the label is recorded in the plan, and `preview` is returned instead.
   */
  effect<T>(label: string, fn: () => T | Promise<T>, preview?: T): Promise<T>;
  /** Throw a structured, agent-recoverable error. */
  fail(code: string, details?: Omit<ActionErrorInit, 'code'>): never;
  /** Effects recorded so far in this call. */
  readonly effects: readonly PlannedEffect[];
}

export interface ActionErrorInit {
  code: string;
  message?: string;
  status?: number;
  /** Plain-language instruction telling an agent how to fix the call. */
  fix?: string;
  /** Name of the offending input field, if any. */
  param?: string;
  retriable?: boolean;
  retryAfter?: number;
  suggest?: Suggestion[];
  docs?: string;
}

export interface ActionExample<I = any> {
  input: I;
  note?: string;
}

export interface ActionSpec<I = any, O = any> {
  /** What the action does, in one or two sentences. Shown to humans and models. */
  description: string;
  /** When an agent should pick this action (and when it should not). Strongly improves tool selection. */
  when?: string;
  /** REST binding, e.g. "POST /orders/:id/refund". Defaults to GET|POST /actions/<name>. */
  http?: string;
  input?: SchemaLike<I>;
  output?: SchemaLike<O>;
  effect?: Effect;
  /** Can an undo handler reverse this? Inferred from `undo` when omitted. */
  reversible?: boolean;
  /** Cost units this call consumes from the caller's spend budget (e.g. dollars). */
  cost?: number | ((input: I) => number);
  /**
   * Human approval gate. Return a reason string (or true) to require a human to approve
   * the exact planned call before it executes.
   */
  approval?: boolean | string | ((input: I, ctx: { caller: Caller }) => boolean | string | undefined | Promise<boolean | string | undefined>);
  /** Who may call this action. `humans` blocks agents; `approval` forces approval for agent callers. */
  agents?: 'allow' | 'deny' | 'approval';
  examples?: ActionExample<I>[];
  tags?: string[];
  run(input: I, ctx: ActionContext): O | Promise<O>;
  /** Compensating action — reverses a completed call. Makes the action undoable via its receipt. */
  undo?(input: I, output: O, ctx: ActionContext): unknown | Promise<unknown>;
  /** Affordances: what the caller can sensibly do after this action succeeds. */
  next?(output: O, input: I): Suggestion[];
}

export interface BudgetRule {
  /** Max calls per rolling minute. */
  requestsPerMinute?: number;
  /** Max cost units (see ActionSpec.cost) per rolling 24h. */
  spendPerDay?: number;
}

export interface AgentOptions {
  /** Service name, shown in manifests and MCP serverInfo. */
  name?: string;
  version?: string;
  description?: string;
  /** Extra guidance for agents (house rules), included in llms.txt and MCP instructions. */
  instructions?: string;
  /** Mount prefix for built-in agent endpoints. Default `/_agent`. */
  basePath?: string;
  /** Path of the MCP endpoint. Default `/mcp`. Set to false to disable. */
  mcpPath?: string | false;
  /** If more actions than this exist, MCP exposes find/describe/run meta-tools instead of every action. Default 24. */
  maxTools?: number;
  /** Custom caller identification. Return undefined to fall back to built-in detection. */
  identify?: (req: MimiRequest) => Partial<Caller> | undefined | Promise<Partial<Caller> | undefined>;
  /** Budgets for agent callers. `perAgent` overrides `default` by caller id. */
  budgets?: { default?: BudgetRule; perAgent?: Record<string, BudgetRule> };
  /** Auto-dedupe identical write calls from the same agent within this window (ms). 0 disables. Default 10000. */
  autoDedupeMs?: number;
  /** How long idempotency results are remembered (ms). Default 24h. */
  idempotencyTtlMs?: number;
  /** How long a pending approval stays valid (ms). Default 1h. */
  approvalTtlMs?: number;
  /** How long a receipt can be undone (ms). Default 24h. */
  undoWindowMs?: number;
  /**
   * Guards admin endpoints (approve/reject, activity, insights).
   * Default: header `x-admin-key` must equal `adminKey`; with no key, allowed only outside production.
   */
  authorizeAdmin?: (req: MimiRequest) => boolean | Promise<boolean>;
  adminKey?: string;
  /** Called when a call needs human approval — wire this to Slack, email, a dashboard... */
  onApprovalRequested?: (approval: ApprovalRecord) => void | Promise<void>;
  /** Pluggable storage (idempotency, approvals, receipts, budgets). Default in-memory. */
  store?: KVStore;
}

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  /** Set only if absent. Returns true when the value was written. */
  setIfAbsent(key: string, value: unknown, ttlMs?: number): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export interface ApprovalRecord {
  id: string;
  action: string;
  input: unknown;
  caller: Caller;
  reason: string;
  plan: Plan;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
  createdAt: string;
  expiresAt: string;
  decidedBy?: string;
  decidedAt?: string;
  result?: unknown;
  receiptId?: string;
  error?: unknown;
}

export interface Plan {
  action: string;
  effect: Effect;
  effects: PlannedEffect[];
  cost: number;
  reversible: boolean;
  approvalRequired: string | false;
  wouldReturn: unknown;
}

export interface Receipt {
  id: string;
  action: string;
  input: unknown;
  output: unknown;
  caller: Caller;
  effects: PlannedEffect[];
  cost: number;
  at: string;
  undoable: boolean;
  undone?: { at: string; by: string };
}

export interface CallOptions {
  caller?: Partial<Caller>;
  dryRun?: boolean;
  idempotencyKey?: string;
  req?: MimiRequest;
}

export type CallOutcome =
  | { status: 'ok'; data: unknown; receipt?: Receipt; next: Suggestion[]; replayed?: 'idempotency-key' | 'auto-dedupe' }
  | { status: 'dry_run'; plan: Plan }
  | { status: 'approval_required'; approval: PublicApproval }
  | { status: 'error'; problem: Problem };

export interface PublicApproval {
  id: string;
  reason: string;
  status: ApprovalRecord['status'];
  plan: Plan;
  expiresAt: string;
  /** Where the agent can poll for the outcome. */
  statusUrl: string;
  /** Tell the agent what to do while waiting. */
  howToProceed: string;
}

/** RFC 9457 problem details, extended for agents. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  fix?: string;
  param?: string;
  retriable: boolean;
  retryAfter?: number;
  suggest?: Suggestion[];
  issues?: Array<{ path: string; message: string; expected?: string; received?: string }>;
  example?: unknown;
  docs?: string;
  action?: string;
}
