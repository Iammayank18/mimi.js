<script setup lang="ts">
import { computed } from 'vue';
import { useCases } from '../data/useCases';
import Icon from './Icon.vue';

const props = defineProps<{ id: string }>();
const uc = computed(() => useCases.find((u) => u.id === props.id));
</script>

<template>
  <div v-if="uc" class="uch">
    <span class="ico"><Icon :name="uc.icon" :size="20" /></span>
    <div class="meta">
      <div class="row">
        <span class="who">{{ uc.who }}</span>
        <span class="tags"><span v-for="t in uc.uses" :key="t">{{ t }}</span></span>
      </div>
      <p class="sum">{{ uc.summary }}</p>
    </div>
  </div>
</template>

<style scoped>
.uch {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin: 16px 0 24px;
  padding: 18px 20px;
  border-radius: var(--m-radius);
  border: 1px solid var(--m-line);
  background: var(--vp-c-bg-alt);
}
.ico {
  flex: none;
  display: grid; place-items: center;
  width: 40px; height: 40px; border-radius: 10px;
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  color: var(--vp-c-text-1);
}
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.who { font-family: var(--vp-font-family-mono); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--vp-c-text-3); }
.tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tags span {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  padding: 1px 7px;
  border-radius: 5px;
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  color: var(--vp-c-text-2);
}
.sum { margin: 6px 0 0 !important; font-size: 15px; line-height: 1.6; color: var(--vp-c-text-1) !important; }
@media (max-width: 520px) { .uch { flex-direction: column; } }
</style>
