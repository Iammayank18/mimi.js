<script setup lang="ts">
import { computed } from 'vue';
import { withBase, useRoute } from 'vitepress';
import { useCases } from '../data/useCases';
import Icon from './Icon.vue';

const props = defineProps<{ limit?: number; variant?: 'cards' | 'cells' }>();
const route = useRoute();
const items = computed(() => (props.limit ? useCases.slice(0, props.limit) : useCases));
const onPage = computed(() => route.path.includes('/guide/use-cases'));
const href = (id: string) => (onPage.value ? `#${id}` : withBase(`/guide/use-cases#${id}`));
</script>

<template>
  <div class="uc-grid" :class="variant ?? 'cards'">
    <a
      v-for="(u, i) in items"
      :key="u.id"
      v-reveal="(i % 3) * 60"
      v-spotlight
      :href="href(u.id)"
      class="uc no-underline"
    >
      <div class="top">
        <span class="ico"><Icon :name="u.icon" :size="18" /></span>
        <span class="who">{{ u.who }}</span>
      </div>
      <h3>{{ u.title }}</h3>
      <p>{{ u.summary }}</p>
      <div class="foot">
        <div class="tags"><span v-for="t in u.uses" :key="t">{{ t }}</span></div>
        <Icon class="go" name="arrow" :size="15" />
      </div>
    </a>
  </div>
</template>

<style scoped>
.uc-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
.uc-grid.cards { gap: 12px; margin: 24px 0 8px; }
.uc-grid.cells { border-top: 1px solid var(--m-line); }

.uc {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  color: inherit;
  transition: border-color 0.2s, background 0.2s;
}
.cards .uc { border: 1px solid var(--m-line); border-radius: var(--m-radius); background: var(--m-surface); }
.cards .uc:hover { border-color: var(--m-line-strong); }
.cells .uc { padding: 32px; border-right: 1px solid var(--m-line); border-bottom: 1px solid var(--m-line); }
.cells .uc:nth-child(3n) { border-right: 0; }
.cells .uc:nth-last-child(-n + 3) { border-bottom: 0; }

.top { display: flex; align-items: center; justify-content: space-between; }
.ico {
  display: grid; place-items: center;
  width: 36px; height: 36px; border-radius: 9px;
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  color: var(--vp-c-text-1);
}
.who {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--vp-c-text-3);
}
h3 { margin: 18px 0 6px !important; padding: 0 !important; border: 0 !important; font-size: 15.5px !important; font-weight: 600 !important; letter-spacing: -0.01em !important; color: var(--vp-c-text-1); line-height: 1.4 !important; }
p { margin: 0 !important; font-size: 14px !important; line-height: 1.65 !important; color: var(--vp-c-text-2) !important; flex: 1; }
.foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 18px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tags span {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid var(--m-line);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
}
.go { color: var(--vp-c-text-3); transition: color 0.2s, transform 0.2s var(--m-ease); }
.uc:hover .go { color: var(--vp-c-text-1); transform: translateX(3px); }

@media (max-width: 1024px) {
  .uc-grid { grid-template-columns: repeat(2, 1fr); }
  .cells .uc:nth-child(3n) { border-right: 1px solid var(--m-line); }
  .cells .uc:nth-child(2n) { border-right: 0; }
  .cells .uc:nth-last-child(-n + 3) { border-bottom: 1px solid var(--m-line); }
  .cells .uc:nth-last-child(-n + 2) { border-bottom: 0; }
}
@media (max-width: 640px) {
  .uc-grid { grid-template-columns: 1fr; }
  .cells .uc { border-right: 0 !important; padding: 24px 20px; border-bottom: 1px solid var(--m-line) !important; }
  .cells .uc:last-child { border-bottom: 0 !important; }
}
</style>
