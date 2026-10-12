import type { SchemaIssue, SchemaLike } from './types';

type JSONSchema = Record<string, any>;

const cache = new WeakMap<object, JSONSchema>();

/** Zod v4 → JSON Schema (via .toJSONSchema), Zod v3 → zod-to-json-schema. */
export function toJSONSchema(schema: SchemaLike | undefined): JSONSchema {
  if (!schema) return { type: 'object', properties: {}, additionalProperties: false };
  const hit = cache.get(schema as object);
  if (hit) return hit;
  let out: JSONSchema = {};
  try {
    if (typeof schema.toJSONSchema === 'function') {
      out = schema.toJSONSchema({ io: 'input', unrepresentable: 'any' } as any);
    } else if ((schema as any)._def) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { zodToJsonSchema } = require('zod-to-json-schema');
      out = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' });
    }
  } catch {
    out = {};
  }
  const { $schema, ...clean } = out;
  cache.set(schema as object, clean);
  return clean;
}

export function issuePath(path: PropertyKey[]): string {
  return path.length ? path.map(String).join('.') : '(root)';
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function getAt(obj: unknown, path: PropertyKey[]): unknown {
  let cur: any = obj;
  for (const p of path) {
    if (cur == null) return undefined;
    cur = cur[p as any];
  }
  return cur;
}

/** Turn schema issues into short, field-level instructions an agent can act on. */
export function describeIssues(issues: SchemaIssue[], input: unknown) {
  return issues.map((i) => {
    const received = getAt(input, i.path);
    return {
      path: issuePath(i.path),
      message: i.message,
      ...(i.expected ? { expected: String(i.expected) } : {}),
      received: received === undefined ? 'missing' : typeOf(received),
    };
  });
}

export function fixSentence(issues: ReturnType<typeof describeIssues>): string {
  const parts = issues.slice(0, 5).map((i) => {
    if (i.received === 'missing') return `add \`${i.path}\`${i.expected ? ` (${i.expected})` : ''}`;
    if (i.expected) return `send \`${i.path}\` as ${i.expected}, not ${i.received}`;
    return `fix \`${i.path}\`: ${i.message}`;
  });
  return parts.length ? `Retry with these changes: ${parts.join('; ')}.` : 'Check the input against the schema.';
}

/**
 * HTTP query strings and path params are always strings. Coerce them using the
 * JSON Schema so `?limit=10` validates against `z.number()` without z.coerce.
 */
export function coerceBySchema(input: Record<string, unknown>, json: JSONSchema): Record<string, unknown> {
  const props: Record<string, JSONSchema> = json?.properties ?? {};
  const out: Record<string, unknown> = { ...input };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== 'string' || !props[k]) continue;
    const types: string[] = [].concat(props[k].type ?? (props[k].anyOf ?? []).map((s: JSONSchema) => s.type)).filter(Boolean);
    if ((types.includes('number') || types.includes('integer')) && v.trim() !== '' && !Number.isNaN(Number(v))) {
      out[k] = Number(v);
    } else if (types.includes('boolean') && (v === 'true' || v === 'false')) {
      out[k] = v === 'true';
    } else if ((types.includes('array') || types.includes('object')) && /^[[{]/.test(v)) {
      try {
        out[k] = JSON.parse(v);
      } catch {
        /* leave as-is; validation will explain */
      }
    }
  }
  return out;
}

/** Add reserved control fields to a tool's input schema (for MCP clients). */
export function withControlFields(json: JSONSchema, opts: { write: boolean }): JSONSchema {
  const base = json && json.type === 'object' ? json : { type: 'object', properties: {}, additionalProperties: true };
  const properties = { ...(base.properties ?? {}) };
  properties._dryRun = {
    type: 'boolean',
    description: 'If true, do not change anything: return the plan (side effects, cost, approval needs) instead.',
  };
  if (opts.write) {
    properties._idempotencyKey = {
      type: 'string',
      description: 'Optional unique key for this intent. Retrying with the same key never repeats the side effect.',
    };
  }
  return { ...base, properties };
}
