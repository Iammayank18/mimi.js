import type { MimiRequest } from '../types';
import type { AgentOptions, Caller } from './types';

/** User-Agent fragments of well-known AI agents and assistants (lower-case). */
const KNOWN_AGENTS: Array<[RegExp, string]> = [
  [/claude-user|claude-web|claudebot|anthropic-ai|claude-code/, 'Claude'],
  [/chatgpt-user|chatgpt-agent|gptbot|openai/, 'ChatGPT'],
  [/perplexity/, 'Perplexity'],
  [/google-agent|gemini|google-extended/, 'Gemini'],
  [/copilot/, 'Copilot'],
  [/mcp-client|mcp\//, 'MCP client'],
];

function header(req: MimiRequest, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Work out who is calling. Order:
 * 1. your `identify(req)` hook
 * 2. MCP transport (always an agent)
 * 3. `X-Agent-Id` / Web Bot Auth `Signature-Agent` headers
 * 4. well-known agent User-Agents
 * 5. otherwise: a human-driven client
 */
export async function identifyCaller(
  req: MimiRequest | undefined,
  via: Caller['via'],
  opts: AgentOptions,
  override?: Partial<Caller>,
): Promise<Caller> {
  if (override?.kind && override.id) {
    return { verified: false, via, ...override } as Caller;
  }
  if (!req) return { kind: 'human', id: 'internal', via, verified: true, ...override };

  const custom = opts.identify ? await opts.identify(req) : undefined;
  if (custom && custom.kind) {
    return { id: custom.id ?? 'anonymous', via, verified: custom.verified ?? true, ...custom } as Caller;
  }

  const ua = (header(req, 'user-agent') ?? '').toLowerCase();
  const explicit = header(req, 'x-agent-id');
  const signatureAgent = header(req, 'signature-agent')?.replace(/^"|"$/g, '');
  const known = [...(opts.agentPatterns ?? []), ...KNOWN_AGENTS].find(([re]) => re.test(ua));

  if (via === 'mcp' || explicit || signatureAgent || known) {
    const id = explicit ?? signatureAgent ?? (known ? known[1].toLowerCase().replace(/\s+/g, '-') : 'mcp-client');
    return {
      kind: 'agent',
      id,
      name: header(req, 'x-agent-name') ?? known?.[1] ?? custom?.name,
      via,
      // Signature verification (Web Bot Auth / HTTP Message Signatures) belongs in `identify`.
      verified: false,
    };
  }
  return { kind: 'human', id: custom?.id ?? req.ip ?? 'anonymous', via, verified: false };
}
