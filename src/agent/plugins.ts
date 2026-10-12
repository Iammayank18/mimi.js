import { createHash } from 'crypto';
import { ActionError } from './errors';
import type { AgentEvent, AgentPlugin, CallInfo, CallOutcome, Effect, KVStore } from './types';

/**
 * Ready-made plugins. Each one is small on purpose — read them as examples
 * of the hook you need, then write your own.
 */

/** Hide sensitive fields (deeply) from responses. Default: only for agent callers. */
export function redact(opts: { fields: string[]; for?: 'agents' | 'all'; mask?: string }): AgentPlugin {
  const fields = new Set(opts.fields.map((f) => f.toLowerCase()));
  const mask = opts.mask ?? '[redacted]';
  const scrub = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, fields.has(k.toLowerCase()) ? mask : scrub(x)]));
    }
    return v;
  };
  return {
    name: 'redact',
    afterCall(call, outcome) {
      if ((opts.for ?? 'agents') === 'agents' && call.caller.kind !== 'agent') return;
      if (outcome.status === 'ok') return { ...outcome, data: scrub(outcome.data) };
      if (outcome.status === 'dry_run') return { ...outcome, plan: { ...outcome.plan, wouldReturn: scrub(outcome.plan.wouldReturn) } };
    },
  };
}

/** A global approval rule that applies to every action, e.g. "agents need approval at night". */
export function approvalRule(name: string, rule: (call: CallInfo) => string | false | undefined | Promise<string | false | undefined>): AgentPlugin {
  return { name: `approval:${name}`, approval: rule };
}

/** Limit which actions each agent may call. Unlisted agents get `defaultScope` (default: everything). */
export function scopes(map: Record<string, string[] | '*'>, opts: { defaultScope?: string[] | '*' } = {}): AgentPlugin {
  return {
    name: 'scopes',
    beforeCall(call) {
      if (call.caller.kind !== 'agent') return;
      const allowed = map[call.caller.id] ?? opts.defaultScope ?? '*';
      if (allowed === '*' || allowed.includes(call.action.name)) return;
      throw new ActionError({
        code: 'OUT_OF_SCOPE',
        status: 403,
        message: `Agent "${call.caller.id}" is not allowed to call "${call.action.name}".`,
        fix: allowed.length ? `You can call: ${allowed.join(', ')}.` : 'This agent has no permitted actions. Ask the user to grant access.',
      });
    },
  };
}

/** Governance: refuse to register risky actions that can't be undone. */
export function requireUndo(opts: { effects?: Effect[] } = {}): AgentPlugin {
  const effects = opts.effects ?? ['spend', 'destructive'];
  return {
    name: 'require-undo',
    onRegister(action) {
      if (effects.includes(action.effect) && !action.undo && action.agents !== 'deny') {
        throw new Error(`Action "${action.name}" (${action.effect}) must define undo() or set agents: 'deny'.`);
      }
    },
  };
}

/** Send every event (calls, approvals, undos) to your own sink: a DB, a file, Datadog, OpenTelemetry... */
export function auditLog(sink: (event: AgentEvent) => void | Promise<void>, opts: { types?: AgentEvent['type'][] } = {}): AgentPlugin {
  return {
    name: 'audit-log',
    onEvent(event) {
      if (!opts.types || opts.types.includes(event.type)) return sink(event);
    },
  };
}

/** Cache successful read actions. Shows the short-circuit power of beforeCall. */
export function cacheReads(opts: { ttlMs?: number; actions?: string[] } = {}): AgentPlugin {
  const ttl = opts.ttlMs ?? 30_000;
  let store: KVStore | undefined;
  const key = (call: CallInfo) =>
    `cache:${call.action.name}:${createHash('sha256').update(JSON.stringify(call.input ?? null)).digest('hex').slice(0, 24)}`;
  const applies = (call: CallInfo) => call.action.effect === 'read' && !call.dryRun && (!opts.actions || opts.actions.includes(call.action.name));
  return {
    name: 'cache-reads',
    setup(kit) {
      store = kit.store;
    },
    async beforeCall(call) {
      if (!applies(call) || !store) return;
      const hit = await store.get<CallOutcome>(key(call));
      if (hit) {
        call.state.cacheHit = true;
        return hit;
      }
    },
    async afterCall(call, outcome) {
      if (!applies(call) || !store || call.state.cacheHit || outcome.status !== 'ok') return;
      await store.set(key(call), outcome, ttl);
    },
  };
}
