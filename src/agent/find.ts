/**
 * Intent search over actions — lets an agent ask "how do I refund an order?"
 * instead of loading every tool definition into its context window.
 * BM25 over name/description/when/tags/fields, with a light synonym table.
 * No model or network needed; swap in embeddings later via `rank`.
 */

const STOP = new Set('a an the to of for and or in on with my me i is it this that be by from at as do does how can want need please'.split(' '));

const SYNONYMS: Record<string, string[]> = {
  refund: ['money', 'back', 'return', 'reimburse', 'chargeback'],
  delete: ['remove', 'destroy', 'erase', 'cancel', 'drop'],
  create: ['add', 'new', 'make', 'insert', 'register', 'place'],
  list: ['all', 'browse', 'show', 'find', 'search', 'get'],
  update: ['change', 'edit', 'modify', 'set', 'rename'],
  send: ['email', 'notify', 'message', 'post'],
  order: ['purchase', 'buy', 'checkout'],
  user: ['customer', 'account', 'member', 'person'],
  product: ['item', 'sku', 'catalog', 'inventory'],
};

const REVERSE: Record<string, string> = {};
for (const [root, words] of Object.entries(SYNONYMS)) for (const w of words) REVERSE[w] = REVERSE[w] ?? root;

function stem(w: string): string {
  return w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '') || w;
}

export function tokenize(text: string): string[] {
  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));
  const out: string[] = [];
  for (const w of words) {
    const s = stem(w);
    out.push(s);
    const root = REVERSE[w] ?? REVERSE[s];
    if (root) out.push(stem(root));
  }
  return out;
}

export interface Doc {
  id: string;
  text: string;
}

export function rank(query: string, docs: Doc[], limit = 5): Array<{ id: string; score: number }> {
  const q = tokenize(query);
  if (!q.length) return [];
  const toks = docs.map((d) => tokenize(d.text));
  const avg = toks.reduce((s, t) => s + t.length, 0) / Math.max(1, toks.length);
  const df = new Map<string, number>();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const k1 = 1.2;
  const b = 0.75;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    for (const w of toks[i]) tf.set(w, (tf.get(w) ?? 0) + 1);
    let score = 0;
    for (const w of new Set(q)) {
      const f = tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * toks[i].length) / avg)));
    }
    return { id: d.id, score: Math.round(score * 1000) / 1000 };
  });
  return scored.filter((s) => s.score > 0).sort((a, b2) => b2.score - a.score).slice(0, limit);
}
