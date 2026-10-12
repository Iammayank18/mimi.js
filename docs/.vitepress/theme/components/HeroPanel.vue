<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

interface Scenario {
  id: string;
  label: string;
  caller: string;
  request: { line: string; body?: string };
  response: { status: string; tone: 'ok' | 'warn' | 'info'; headers?: string[]; body: string };
  note: string;
}

const scenarios: Scenario[] = [
  {
    id: 'rest',
    label: 'REST',
    caller: 'Your app',
    request: {
      line: 'POST /orders/ord_101/refund',
      body: '{ "amount": 40, "reason": "damaged" }',
    },
    response: {
      status: '200 OK',
      tone: 'ok',
      headers: ['X-Receipt-Id: rcpt_9f2c41'],
      body: '{ "refundId": "re_3KJ8", "remaining": 35 }',
    },
    note: 'Plain JSON for humans and existing clients. Nothing changes for them.',
  },
  {
    id: 'mcp',
    label: 'MCP',
    caller: 'Claude / ChatGPT',
    request: {
      line: 'tools/call  refundOrder',
      body: '{ "orderId": "ord_101", "amount": 40, "reason": "damaged" }',
    },
    response: {
      status: 'result',
      tone: 'ok',
      body: '{\n  "data": { "refundId": "re_3KJ8", "remaining": 35 },\n  "receipt": { "id": "rcpt_9f2c41", "undoable": true },\n  "next": [{ "action": "emailCustomer", "why": "Confirm the refund" }]\n}',
    },
    note: 'Same action as an MCP tool, with a receipt and suggested next steps.',
  },
  {
    id: 'plan',
    label: 'Dry run',
    caller: 'Agent',
    request: {
      line: 'POST /orders/ord_101/refund?dryRun=true',
      body: '{ "amount": 40, "reason": "damaged" }',
    },
    response: {
      status: '200 OK · nothing changed',
      tone: 'info',
      body: '{\n  "plan": {\n    "effects": ["Refund $40 to card •••4242"],\n    "cost": 40,\n    "reversible": true,\n    "approvalRequired": false\n  }\n}',
    },
    note: 'Every action can preview its side effects before running them.',
  },
  {
    id: 'approval',
    label: 'Approval',
    caller: 'Agent',
    request: {
      line: 'POST /orders/ord_101/refund',
      body: '{ "amount": 180, "reason": "changed mind" }',
    },
    response: {
      status: '202 Accepted',
      tone: 'warn',
      headers: ['Location: /_agent/approvals/apr_71e0'],
      body: '{\n  "status": "approval_required",\n  "reason": "Refunds over $100 need a human",\n  "plan": { "effects": ["Refund $180 to card •••4242"] }\n}',
    },
    note: 'Risky calls wait for a person. The exact plan is what gets executed.',
  },
];

const active = ref(0);
const auto = ref(true);
const progressKey = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
const current = computed(() => scenarios[active.value]);

function select(i: number) {
  active.value = i;
  auto.value = false;
  clearInterval(timer);
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    auto.value = false;
    return;
  }
  timer = setInterval(() => {
    active.value = (active.value + 1) % scenarios.length;
    progressKey.value++;
  }, 5200);
});
onBeforeUnmount(() => clearInterval(timer));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function hl(json: string) {
  return esc(json)
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="tk-key">$1</span>$2')
    .replace(/(:\s*|\[\s*|,\s*)("(?:[^"\\]|\\.)*")/g, '$1<span class="tk-str">$2</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="tk-bool">$1</span>')
    .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, '$1<span class="tk-num">$2</span>');
}
</script>

<template>
  <div class="panel">
    <div class="bar">
      <div class="tabs" role="tablist" aria-label="Same action, different callers">
        <button
          v-for="(s, i) in scenarios"
          :key="s.id"
          role="tab"
          :aria-selected="i === active"
          :class="{ on: i === active }"
          @click="select(i)"
        >
          {{ s.label }}
          <span v-if="i === active && auto" :key="progressKey" class="progress" />
        </button>
      </div>
      <span class="action-name">refundOrder</span>
    </div>

    <Transition name="swap" mode="out-in">
      <div :key="current.id" class="body">
        <div class="pane">
          <div class="pane-head">
            <span class="lbl">Request</span>
            <span class="who">{{ current.caller }}</span>
          </div>
          <div class="reqline">{{ current.request.line }}</div>
          <pre v-if="current.request.body"><code v-html="hl(current.request.body)" /></pre>
        </div>
        <div class="pane">
          <div class="pane-head">
            <span class="lbl">Response</span>
            <span class="status" :class="current.response.tone"><i />{{ current.response.status }}</span>
          </div>
          <div v-for="h in current.response.headers" :key="h" class="hdr">{{ h }}</div>
          <pre><code v-html="hl(current.response.body)" /></pre>
          <div v-if="current.id === 'approval'" class="approve">
            <div>
              <div class="ap-title">Refund $180 · ord_101</div>
              <div class="ap-sub">Requested by support-agent · expires in 59 min</div>
            </div>
            <div class="ap-actions">
              <span class="ap-btn ghost">Reject</span>
              <span class="ap-btn">Approve</span>
            </div>
          </div>
        </div>
        <p class="note">{{ current.note }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.panel {
  position: relative;
  border: 1px solid var(--m-line);
  border-radius: 14px;
  background: var(--m-surface);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 24px 60px -30px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.dark .panel {
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 30px 80px -40px rgba(0, 0, 0, 0.9);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--m-line);
  background: var(--m-surface-2);
}
.tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.tabs button {
  position: relative;
  padding: 13px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  transition: color 0.15s;
}
.tabs button:hover { color: var(--vp-c-text-1); }
.tabs button.on { color: var(--vp-c-text-1); }
.tabs button.on::after {
  content: '';
  position: absolute; left: 12px; right: 12px; bottom: -1px;
  height: 1px; background: var(--vp-c-text-1);
}
.progress {
  position: absolute; left: 12px; bottom: -1px;
  height: 1px; width: calc(100% - 24px);
  background: var(--m-accent);
  transform-origin: left;
  animation: prog 5.2s linear forwards;
  z-index: 1;
}
@keyframes prog { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.action-name {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.body { padding: 4px 0 0; }
.pane { padding: 14px 18px; }
.pane + .pane { border-top: 1px dashed var(--m-line); }
.pane-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.lbl { font-family: var(--vp-font-family-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--vp-c-text-3); }
.who { font-size: 12px; color: var(--vp-c-text-2); }
.reqline {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  margin-bottom: 8px;
  overflow-x: auto;
  white-space: nowrap;
}
.hdr {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
}
pre {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--m-surface-2);
  border: 1px solid var(--m-line);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.65;
  color: #27272a;
  overflow-x: auto;
}
code { background: none; border: 0; padding: 0; color: inherit; font-size: inherit; }
pre :deep(.tk-key) { color: #4338ca; }
pre :deep(.tk-str) { color: #047857; }
pre :deep(.tk-num) { color: #c2410c; }
pre :deep(.tk-bool) { color: #be185d; }

.status {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status.ok { color: var(--m-ok); }
.status.warn { color: var(--m-warn); }
.status.info { color: var(--vp-c-brand-1); }
.approve {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--m-line);
  background: var(--m-surface-2);
}
.ap-title { font-size: 13px; font-weight: 600; color: var(--vp-c-text-1); }
.ap-sub { font-size: 12px; color: var(--vp-c-text-3); margin-top: 2px; }
.ap-actions { display: flex; gap: 6px; }
.ap-btn {
  font-size: 12px; font-weight: 500;
  padding: 5px 10px; border-radius: 6px;
  background: var(--vp-c-text-1); color: var(--vp-c-bg);
}
.ap-btn.ghost { background: transparent; color: var(--vp-c-text-2); border: 1px solid var(--m-line); }
.note {
  margin: 0;
  padding: 12px 18px 14px;
  border-top: 1px solid var(--m-line);
  font-size: 13px;
  color: var(--vp-c-text-2);
  background: var(--m-surface-2);
}
.swap-enter-active, .swap-leave-active { transition: opacity 0.22s var(--m-ease), transform 0.22s var(--m-ease); }
.swap-enter-from { opacity: 0; transform: translateY(4px); }
.swap-leave-to { opacity: 0; }
@media (max-width: 520px) {
  .action-name { display: none; }
  .approve { flex-direction: column; align-items: flex-start; }
}
</style>

<style>
.dark .panel pre { background: var(--m-code-bg); border-color: rgba(255, 255, 255, 0.05); color: #d4d4d8; }
.dark .panel pre .tk-key { color: #a5b4fc; }
.dark .panel pre .tk-str { color: #86efac; }
.dark .panel pre .tk-num { color: #fdba74; }
.dark .panel pre .tk-bool { color: #f9a8d4; }
</style>
