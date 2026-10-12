<script setup lang="ts">
import Icon from './Icon.vue';

const steps = [
  { icon: 'id', name: 'Identify', note: 'Human or agent' },
  { icon: 'check_circle', name: 'Validate', note: 'Fix + example on error' },
  { icon: 'plug', name: 'Plugins', note: 'beforeCall hooks' },
  { icon: 'wallet', name: 'Budget', note: 'Scopes, rate, spend' },
  { icon: 'shield', name: 'Approval', note: 'Park exact plan' },
  { icon: 'plan', name: 'Dry run', note: 'Plan, no side effects' },
  { icon: 'retry', name: 'Idempotency', note: 'Never twice' },
  { icon: 'zap', name: 'Execute', note: 'ctx.effect()' },
  { icon: 'receipt', name: 'Receipt', note: 'Undo, next, audit' },
];
const total = steps.length * 0.75;
</script>

<template>
  <div class="pipe" :style="{ '--total': `${total}s` }">
    <div class="track" aria-hidden="true"><span class="runner" /></div>
    <ol>
      <li v-for="(s, i) in steps" :key="s.name" :style="{ '--d': `${i * 0.75}s` }">
        <span class="node"><Icon :name="s.icon" :size="18" /></span>
        <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="name">{{ s.name }}</span>
        <span class="note">{{ s.note }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.pipe {
  position: relative;
  padding: 32px 24px 28px;
  border-radius: var(--m-radius);
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  overflow: hidden;
}
.track {
  position: absolute;
  left: calc(24px + (100% - 48px) / 18);
  right: calc(24px + (100% - 48px) / 18);
  top: 53px;
  height: 1px;
  background: var(--m-line-strong);
}
.runner {
  position: absolute; top: -0.5px; left: 0;
  width: 64px; height: 2px;
  background: linear-gradient(90deg, transparent, var(--vp-c-brand-1), transparent);
  animation: run var(--total) linear infinite;
}
@keyframes run {
  from { left: -64px; }
  to { left: 100%; }
}
ol {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 8px;
}
li { display: flex; flex-direction: column; align-items: center; text-align: center; margin: 0; }
.node {
  display: grid; place-items: center;
  width: 42px; height: 42px;
  border-radius: 10px;
  border: 1px solid var(--m-line-strong);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  animation: lit var(--total) linear infinite;
  animation-delay: var(--d);
  transition: color 0.2s, border-color 0.2s;
}
li:hover .node { color: var(--vp-c-text-1); border-color: var(--vp-c-text-3); }
@keyframes lit {
  0%, 12%, 100% { color: var(--vp-c-text-2); border-color: var(--m-line-strong); }
  4% { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
}
.num { margin-top: 12px; font-family: var(--vp-font-family-mono); font-size: 11px; color: var(--vp-c-text-3); }
.name { margin-top: 2px; font-size: 13.5px; font-weight: 600; color: var(--vp-c-text-1); }
.note { margin-top: 2px; font-size: 12px; color: var(--vp-c-text-3); line-height: 1.4; }

@media (max-width: 960px) {
  ol { grid-template-columns: repeat(3, 1fr); row-gap: 28px; }
  .track { display: none; }
}
@media (max-width: 480px) {
  ol { grid-template-columns: repeat(2, 1fr); }
}
</style>
