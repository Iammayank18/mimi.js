import type { AgentKit } from './kit';

const EFFECT_NOTE: Record<string, string> = {
  read: 'read-only',
  write: 'changes data',
  destructive: 'deletes/overwrites data',
  spend: 'spends money',
  external: 'contacts the outside world',
};

export const CONVENTIONS = {
  dryRun: 'Add `?dryRun=true` (REST), header `Prefer: dry-run`, or `_dryRun: true` (MCP) to any action to get a plan — side effects, cost, approval needs — without changing anything.',
  idempotency: 'Send `Idempotency-Key: <uuid>` (REST) or `_idempotencyKey` (MCP) on writes. Retries with the same key return the original result and never repeat the side effect.',
  approvals: 'Risky calls return HTTP 202 / status `approval_required` with a plan and a statusUrl. A human approves the exact call; poll statusUrl for the result. Do not resubmit.',
  errors: 'Errors are RFC 9457 problem+json with `code`, `fix` (what to change), `retriable`, `retryAfter`, and `suggest` (actions to call instead).',
  receipts: 'Every write returns a receipt id. Reversible actions can be undone via POST {basePath}/receipts/{id}/undo or the `undo_action` tool.',
  identity: 'Agents should send `X-Agent-Id` (or Web Bot Auth `Signature-Agent`). Budgets and audit logs are per agent.',
};

export function buildManifest(kit: AgentKit, origin = '') {
  const o = kit.options;
  return {
    schema: 'https://mimijs.dev/schemas/agent-manifest/v0.json',
    name: o.name ?? 'mimi.js API',
    version: o.version ?? '1.0.0',
    ...(o.description && { description: o.description }),
    ...(o.instructions && { instructions: o.instructions }),
    endpoints: {
      ...(o.mcpPath !== false && { mcp: `${origin}${o.mcpPath ?? '/mcp'}` }),
      find: `${origin}${o.basePath}/find?q={intent}`,
      describe: `${origin}${o.basePath}/actions/{name}`,
      approvals: `${origin}${o.basePath}/approvals/{id}`,
      receipts: `${origin}${o.basePath}/receipts/{id}`,
      llms: `${origin}/llms.txt`,
    },
    conventions: Object.fromEntries(Object.entries(CONVENTIONS).map(([k, v]) => [k, v.replace('{basePath}', o.basePath)])),
    actions: [...kit.actions.keys()].map((n) => kit.describe(n)),
  };
}

export function buildLlmsTxt(kit: AgentKit, origin = ''): string {
  const o = kit.options;
  const lines: string[] = [];
  lines.push(`# ${o.name ?? 'mimi.js API'}`, '');
  if (o.description) lines.push(`> ${o.description}`, '');
  if (o.instructions) lines.push(o.instructions, '');
  lines.push('## How to use this API as an agent', '');
  if (o.mcpPath !== false) lines.push(`- MCP endpoint (Streamable HTTP): ${origin}${o.mcpPath ?? '/mcp'}`);
  lines.push(`- Full machine-readable manifest: ${origin}/.well-known/agent.json`);
  lines.push(`- Find the right action for an intent: GET ${origin}${o.basePath}/find?q=refund+an+order`);
  for (const v of Object.values(CONVENTIONS)) lines.push(`- ${v.replace('{basePath}', o.basePath)}`);
  lines.push('', '## Actions', '');
  for (const a of kit.actions.values()) {
    const flags = [EFFECT_NOTE[a.effect]];
    if (a.reversible) flags.push('undoable');
    if (a.approval || a.agents === 'approval') flags.push('may need approval');
    if (a.agents === 'deny') flags.push('humans only');
    lines.push(`- **${a.name}** — \`${a.method} ${a.path}\` (${flags.join(', ')}): ${a.description}${a.when ? ` _When:_ ${a.when}` : ''}`);
  }
  return lines.join('\n') + '\n';
}

/** Short system-prompt style guidance returned in MCP `initialize` / `server/discover`. */
export function buildInstructions(kit: AgentKit): string {
  const o = kit.options;
  return [
    o.description ?? '',
    o.instructions ?? '',
    'Before any write, spend or destructive action, call it with `_dryRun: true` to see the plan and confirm it with the user if anything is surprising.',
    'Pass `_idempotencyKey` on writes so retries are safe.',
    'If a result says `approval_required`, tell the user and use `check_approval` later — never resubmit.',
    'Errors include a `fix` field: follow it instead of guessing.',
  ]
    .filter(Boolean)
    .join('\n');
}
