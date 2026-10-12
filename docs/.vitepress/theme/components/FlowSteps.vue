<script setup lang="ts">
/**
 * A vertical timeline of what happens during a call.
 * steps: array of "text" or ["kind", "text"], kind ∈ agent | mimi | ok | wait | human | stop
 */
const props = defineProps<{ steps: Array<string | [string, string]>; title?: string }>();
const norm = props.steps.map((s) => (Array.isArray(s) ? { kind: s[0], text: s[1] } : { kind: 'mimi', text: s }));
const label: Record<string, string> = { agent: 'agent', mimi: 'mimi', ok: 'result', wait: 'pending', human: 'human', stop: 'blocked' };
</script>

<template>
  <div v-reveal class="flowsteps">
    <div class="ttl">{{ title ?? 'What happens' }}</div>
    <ol>
      <li v-for="(s, i) in norm" :key="i" :class="s.kind" :style="{ '--i': i }">
        <span class="k">{{ label[s.kind] ?? s.kind }}</span>
        <span class="t">{{ s.text }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.flowsteps {
  margin: 20px 0 28px;
  border-radius: var(--m-radius);
  border: 1px solid var(--m-line);
  overflow: hidden;
}
.ttl {
  padding: 10px 16px;
  border-bottom: 1px solid var(--m-line);
  background: var(--vp-c-bg-alt);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--vp-c-text-3);
}
ol { list-style: none; margin: 0 !important; padding: 8px 0 !important; }
li {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 14px;
  align-items: baseline;
  padding: 7px 16px !important;
  margin: 0 !important;
  font-size: 14px;
  line-height: 1.6;
  transition: background 0.15s;
}
li:hover { background: var(--vp-c-bg-alt); }
.k {
  position: relative;
  padding-left: 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.k::before {
  content: '';
  position: absolute; left: 0; top: 50%;
  width: 6px; height: 6px; margin-top: -3px;
  border-radius: 50%;
  background: var(--c, var(--vp-c-text-3));
}
.t { color: var(--vp-c-text-1); }
.agent { --c: #3b82f6; }
.mimi { --c: var(--vp-c-brand-1); }
.ok { --c: var(--m-ok); }
.wait, .human { --c: var(--m-warn); }
.stop { --c: var(--m-err); }
@media (max-width: 520px) {
  li { grid-template-columns: 1fr; gap: 2px; }
}
</style>
