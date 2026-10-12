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

  // ── customisation ───────────────────────────────────────────────
  /** Plugins applied in order. Same as calling `ai.use(plugin)` for each. */
  plugins?: AgentPlugin[];
  /** Replace intent search (e.g. with embeddings or a vector DB). */
  rank?: (query: string, actions: RegisteredAction[], limit: number) => RankResult[] | Promise<RankResult[]>;
  /** Extra User-Agent patterns to recognise as agents, checked before the built-in list. */
  agentPatterns?: Array<[RegExp, string]>;
  /** Fully control the HTTP response for an outcome. Return undefined to use the default shape. */
  formatResponse?: (outcome: CallOutcome, ctx: { caller: Caller; req: MimiRequest; action: string }) => FormattedResponse | undefined;
  /** Base URL for problem `type` links, e.g. "https://api.acme.com/errors/". */
  problemBaseUrl?: string;
}

export interface RankResult {
  name: string;
  score: number;
}

export interface FormattedResponse {
  status?: number;
  headers?: Record<string, string>;
  body: unknown;
}

/** A registered action: the spec plus resolved defaults. */
export interface RegisteredAction extends ActionSpec {
  name: string;
  effect: Effect;
  method: string;
  path: string;
  reversible: boolean;
}

/** What plugins see about a call. `state` is scratch space shared across one call's hooks. */
export interface CallInfo {
  action: RegisteredAction;
  /** Validated input (plugins may replace it in beforeCall). */
  input: unknown;
  caller: Caller;
  dryRun: boolean;
  req?: MimiRequest;
  startedAt: number;
  state: Record<string, unknown>;
}

export type AgentEvent =
  | { type: 'call'; at: string; action: string; caller: Pick<Caller, 'kind' | 'id' | 'name' | 'via'>; outcome: CallOutcome['status']; code?: string; ms: number; receiptId?: string }
  | { type: 'approval.requested'; at: string; approval: ApprovalRecord }
  | { type: 'approval.decided'; at: string; approval: ApprovalRecord; decision: 'approved' | 'rejected' }
  | { type: 'undo'; at: string; receipt: Receipt; by: Pick<Caller, 'kind' | 'id'> };

export interface ToolContext {
  caller: Caller;
  req?: MimiRequest;
}

/** An extra MCP tool contributed by a plugin (not an action — no REST route, no contract). */
export interface CustomTool {
  name: string;
  title?: string;
  description: string;
  /** Zod schema or plain JSON Schema object. */
  input?: SchemaLike | Record<string, unknown>;
  annotations?: Record<string, unknown>;
  run(args: any, ctx: ToolContext): unknown | Promise<unknown>;
}

/**
 * A plugin customises the agent layer without forking it. Every field is optional.
 *
 * Order of hooks for one call:
 *   validate → beforeCall → (policy, budgets) → approval → run/plan → afterCall → onEvent
 */
export interface AgentPlugin {
  name: string;
  /** Runs once when the plugin is added. Plugins may register their own actions here. */
  setup?(kit: AgentKitLike): void | Promise<void>;
  /** Inspect or change every action definition. Throw to reject an action (governance). */
  onRegister?(action: RegisteredAction): void;
  /**
   * Runs after validation, before policies and execution.
   * Change `call.input`, stash data in `call.state`, throw `ActionError` to reject,
   * or return an outcome to short-circuit (e.g. serve from cache).
   */
  beforeCall?(call: CallInfo): void | CallOutcome | Promise<void | CallOutcome>;
  /** Add a global approval rule. Return a reason string to require human approval. */
  approval?(call: CallInfo): string | false | undefined | Promise<string | false | undefined>;
  /** Inspect or replace the outcome (redact data, add next steps, translate errors). */
  afterCall?(call: CallInfo, outcome: CallOutcome): void | CallOutcome | Promise<void | CallOutcome>;
  /** Observe everything: calls, approvals, undos. Errors here never affect the call. */
  onEvent?(event: AgentEvent): void | Promise<void>;
  /** Extra MCP tools. */
  tools?: CustomTool[];
  /** Mount extra HTTP routes (dashboards, webhooks, health checks). */
  routes?(app: any, kit: AgentKitLike): void;
}

/** The subset of AgentKit plugins can rely on. */
export interface AgentKitLike {
  readonly actions: ReadonlyMap<string, RegisteredAction>;
  readonly options: AgentOptions;
  readonly store: KVStore;
  action<I = any, O = any>(name: string, spec: ActionSpec<I, O>): unknown;
  call(name: string, input: unknown, opts?: CallOptions): Promise<CallOutcome>;
  find(query: string, limit?: number): Promise<Array<{ name: string; score: number; description: string; effect: Effect; http: string }>>;
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
