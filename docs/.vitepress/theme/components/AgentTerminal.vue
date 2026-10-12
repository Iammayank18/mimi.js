<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

type Line = { kind: 'user' | 'call' | 'ok' | 'plan' | 'wait' | 'human' | 'note'; text: string; meta?: string };

const lines: Line[] = [
  { kind: 'user', text: 'Buy 3 Mimi tees for sam@example.com' },
  { kind: 'call', text: 'placeOrder', meta: '{ productId: "p_tee", quantity: 3, _dryRun: true }' },
  { kind: 'plan', text: 'plan  Charge $75 and reserve 3× Mimi T-shirt · no approval needed' },
  { kind: 'call', text: 'placeOrder', meta: '{ …, _idempotencyKey: "sam-tee-1" }' },
  { kind: 'ok', text: 'ok  ord_101 · receipt rcpt_fa82 · next: emailCustomer' },
  { kind: 'note', text: 'network blip — agent retries' },
  { kind: 'ok', text: 'replayed  same order, card charged once' },
  { kind: 'call', text: 'refundOrder', meta: '{ orderId: "ord_101", amount: 60 }' },
  { kind: 'wait', text: 'approval_required  "Refunds over $50 need a human"' },
  { kind: 'human', text: 'ops@acme approved the exact plan' },
  { kind: 'ok', text: 'executed  refunded $60 · undoable' },
];

const visible = ref(0);
const root = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
let io: IntersectionObserver | undefined;

function play() {
  clearTimeout(timer);
  const step = () => {
    if (visible.value < lines.length) {
      visible.value++;
      timer = setTimeout(step, lines[visible.value - 1]?.kind === 'user' ? 1100 : 850);
    } else {
      timer = setTimeout(() => {
        visible.value = 0;
        timer = setTimeout(step, 600);
      }, 4200);
    }
  };
  step();
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    visible.value = lines.length;
    return;
  }
  io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      play();
      io?.disconnect();
    }
  }, { threshold: 0.3 });
  if (root.value) io.observe(root.value);
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  io?.disconnect();
});

const who: Record<Line['kind'], string> = {
  user: 'user',
  call: 'call',
  ok: 'mimi',
  plan: 'mimi',
  wait: 'mimi',
  human: 'human',
  note: '',
};
</script>

<template>
  <div ref="root" class="term" role="img" aria-label="An AI agent placing an order and requesting a refund through mimi.js">
    <div class="chrome">
      <span /><span /><span />
      <span class="title">mcp session · demo-agent</span>
      <span class="live"><i /> connected</span>
    </div>
    <div class="body">
      <TransitionGroup name="line">
        <div v-for="(l, i) in lines.slice(0, visible)" :key="i" class="line" :class="l.kind">
          <span v-if="who[l.kind]" class="who">{{ who[l.kind] }}</span>
          <span class="txt">
            {{ l.text }}<span v-if="l.meta" class="meta"> {{ l.meta }}</span>
          </span>
        </div>
      </TransitionGroup>
      <span class="cursor" />
    </div>
  </div>
</template>

<style scoped>
.term {
  border-radius: var(--m-radius);
  background: var(--m-code-bg);
  border: 1px solid var(--m-line);
  overflow: hidden;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: #d4d4d8;
}
.dark .term { border-color: #232328; }
.chrome {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.chrome > span:nth-child(-n + 3) { width: 8px; height: 8px; border-radius: 50%; background: #2a2a30; }
.title { margin-left: 8px; color: #8b8b94; font-size: 12px; }
.live { margin-left: auto; font-size: 11px; color: #8b8b94; display: flex; align-items: center; gap: 6px; }
.live i { width: 6px; height: 6px; border-radius: 50%; background: #34d399; animation: blink 2s infinite; }
@keyframes blink { 50% { opacity: 0.35; } }
.body { padding: 14px 16px 18px; min-height: 392px; }
.line {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  padding: 5px 8px;
  margin: 1px -8px;
  border-radius: 6px;
  line-height: 1.6;
  transition: background 0.15s;
}
.line:hover { background: rgba(255, 255, 255, 0.03); }
.who { color: #5f5f68; text-align: right; white-space: nowrap; }
.user .txt { color: #fafafa; }
.call .txt { color: #c7d2fe; }
.meta { color: #8b8b94; margin-left: 1ch; }
.ok .txt { color: #86efac; }
.plan .txt { color: #d4d4d8; }
.wait .txt { color: #fcd34d; }
.human .txt { color: #e4e4e7; }
.note { grid-template-columns: 1fr; }
.note .txt { color: #5f5f68; text-align: center; }
.note .txt::before, .note .txt::after { content: ' —— '; }
.cursor {
  display: inline-block; width: 7px; height: 14px; margin-left: 76px; margin-top: 6px;
  background: #a1a1aa; animation: blink 1.1s steps(1) infinite;
}
.line-enter-active { transition: opacity 0.35s var(--m-ease), transform 0.35s var(--m-ease); }
.line-enter-from { opacity: 0; transform: translateY(4px); }
.line-leave-active { display: none; }

@media (max-width: 560px) {
  .term { font-size: 11.5px; }
  .line { grid-template-columns: 1fr; gap: 0; }
  .who { text-align: left; }
  .cursor { margin-left: 0; }
  .body { min-height: 500px; }
}
</style>
