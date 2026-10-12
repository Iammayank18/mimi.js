import type { MimiApp, MimiRequest, MimiResponse } from '../types';
import { registry } from '../schema/registry';
import { AgentKit } from './kit';
import { mountAction, mountSystemRoutes } from './http';
import { createMcpHandler } from './mcp';
import type { AgentOptions } from './types';

/**
 * Turn a mimi app into an agent-native API.
 *
 * ```ts
 * const app = mimi();
 * const ai = agent(app, { name: 'Acme Store' });
 * ai.action('refundOrder', { description, input, effect: 'spend', approval, run, undo });
 * ```
 *
 * Every action is served as a REST route, an MCP tool, and an entry in
 * /.well-known/agent.json and /llms.txt — with dry-run plans, idempotency,
 * approval gates, receipts/undo, per-agent budgets and audit built in.
 */
export function agent(app: MimiApp, options: AgentOptions = {}): AgentKit {
  const kit = new AgentKit(options, false);

  kit.onRegister = (action) => {
    mountAction(app, kit, action);
    // Feed the existing OpenAPI registry so /api-docs shows actions too.
    registry.register(action.method, action.path, {
      summary: action.name,
      description: [action.description, action.when && `When: ${action.when}`, `Effect: ${action.effect}`].filter(Boolean).join('\n\n'),
      tags: action.tags ?? ['actions'],
      ...(action.input && action.method !== 'GET' && action.input.toJSONSchema ? { body: action.input as any } : {}),
    });
  };

  mountSystemRoutes(app, kit);

  const mcpPath = options.mcpPath ?? '/mcp';
  if (mcpPath !== false) {
    const handler = createMcpHandler(kit);
    app.post(mcpPath, handler as any);
    app.get(mcpPath, ((_req: MimiRequest, res: MimiResponse) => {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end();
    }) as any);
  }

  kit.attach(app);
  for (const p of options.plugins ?? []) kit.use(p);

  return kit;
}

export { AgentKit } from './kit';
export { ActionError } from './errors';
export { MemoryStore } from './store';
export { MCP_VERSIONS } from './mcp';
export type * from './types';
export type { RegisteredAction, ActivityEvent } from './kit';
export { redact, approvalRule, scopes, requireUndo, auditLog, cacheReads } from './plugins';
