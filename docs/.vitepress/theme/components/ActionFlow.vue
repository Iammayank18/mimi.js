<script setup lang="ts">
import Icon from './Icon.vue';

const outputs = [
  { icon: 'route', tag: 'REST endpoint', who: 'Web & mobile apps', line: 'POST /orders/:id/refund' },
  { icon: 'bot', tag: 'MCP tool', who: 'Claude · ChatGPT · Cursor', line: 'tools/call  refundOrder' },
  { icon: 'file', tag: 'Agent manifest', who: 'Any agent', line: '/.well-known/agent.json  ·  /llms.txt' },
  { icon: 'layers', tag: 'OpenAPI', who: 'SDKs & Swagger UI', line: '/api-docs' },
];
</script>

<template>
  <div class="flow">
    <div class="source">
      <div class="src-head">
        <span class="file">server.ts</span>
        <span class="dots"><i /><i /><i /></span>
      </div>
<pre><code><span class="f">ai.action</span>(<span class="s">'refundOrder'</span>, {
  description: <span class="s">'Refund an order to the card'</span>,
  http: <span class="s">'POST /orders/:id/refund'</span>,
  effect: <span class="s">'spend'</span>,
  input: z.object({ orderId, amount }),
  approval: (i) <span class="k">=&gt;</span> i.amount &gt; <span class="n">100</span>,
  run, undo,
});</code></pre>
    </div>

    <svg class="wires" viewBox="0 0 200 400" preserveAspectRatio="none" aria-hidden="true">
      <g v-for="(o, i) in outputs" :key="o.tag">
        <path class="base" :d="`M0 200 C 110 200, 90 ${50 + i * 100}, 200 ${50 + i * 100}`" />
        <path class="pulse" :style="{ animationDelay: `${i * 0.6}s` }" :d="`M0 200 C 110 200, 90 ${50 + i * 100}, 200 ${50 + i * 100}`" />
      </g>
    </svg>

    <div class="targets">
      <div v-for="(o, i) in outputs" :key="o.tag" v-reveal="i * 70" class="target">
        <span class="t-ico"><Icon :name="o.icon" :size="17" /></span>
        <div class="t-body">
          <div class="t-head">
            <span class="t-tag">{{ o.tag }}</span>
            <span class="t-who">{{ o.who }}</span>
          </div>
          <code class="t-line">{{ o.line }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px minmax(0, 1fr);
  align-items: center;
}
.source {
  border-radius: var(--m-radius);
  border: 1px solid var(--m-line);
  background: var(--m-code-bg);
  overflow: hidden;
}
.src-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.file { font-family: var(--vp-font-family-mono); font-size: 12px; color: #8b8b94; }
.dots { display: flex; gap: 5px; }
.dots i { width: 8px; height: 8px; border-radius: 50%; background: #2a2a30; }
pre {
  margin: 0;
  padding: 18px 18px 20px;
  color: #d4d4d8;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.75;
  overflow-x: auto;
}
code { background: none; border: 0; padding: 0; color: inherit; font-size: inherit; }
.f { color: #a5b4fc; }
.s { color: #86efac; }
.k { color: #c4b5fd; }
.n { color: #fdba74; }

.wires { width: 100%; height: 400px; overflow: visible; }
.base { fill: none; stroke: var(--m-line-strong); stroke-width: 1; vector-effect: non-scaling-stroke; }
.pulse {
  fill: none;
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.5;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 28 400;
  stroke-dashoffset: 28;
  animation: flow 2.8s cubic-bezier(0.45, 0, 0.2, 1) infinite;
}
@keyframes flow {
  0% { stroke-dashoffset: 28; opacity: 0; }
  12% { opacity: 1; }
  85% { opacity: 1; }
  100% { stroke-dashoffset: -320; opacity: 0; }
}

.targets { display: grid; grid-template-rows: repeat(4, 1fr); gap: 12px; height: 400px; }
.target {
  display: flex; align-items: center; gap: 14px;
  padding: 0 18px;
  border-radius: var(--m-radius);
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  transition: border-color 0.2s;
}
.target:hover { border-color: var(--m-line-strong); }
.t-ico {
  display: grid; place-items: center; flex: none;
  width: 34px; height: 34px; border-radius: 8px;
  border: 1px solid var(--m-line);
  color: var(--vp-c-text-1);
}
.t-body { min-width: 0; flex: 1; }
.t-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.t-tag { font-size: 14.5px; font-weight: 600; color: var(--vp-c-text-1); }
.t-who { font-size: 12px; color: var(--vp-c-text-3); white-space: nowrap; }
.t-line { display: block; margin-top: 3px; font-family: var(--vp-font-family-mono); font-size: 12px; color: var(--vp-c-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

@media (max-width: 900px) {
  .flow { grid-template-columns: 1fr; gap: 14px; }
  .wires { display: none; }
  .targets { height: auto; grid-template-rows: none; grid-template-columns: 1fr 1fr; }
  .target { padding: 14px 16px; }
}
@media (max-width: 560px) {
  .targets { grid-template-columns: 1fr; }
  .t-who { display: none; }
}
</style>
