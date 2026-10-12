import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import type { Directive } from 'vue';
import './custom.css';

import HomePage from './components/HomePage.vue';
import ActionFlow from './components/ActionFlow.vue';
import AgentTerminal from './components/AgentTerminal.vue';
import ContractPipeline from './components/ContractPipeline.vue';
import UseCaseGrid from './components/UseCaseGrid.vue';
import FlowSteps from './components/FlowSteps.vue';
import UseCaseHeader from './components/UseCaseHeader.vue';
import HeroPanel from './components/HeroPanel.vue';
import Icon from './components/Icon.vue';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** v-reveal — fade/slide elements in when they scroll into view. Optional value = delay in ms. */
const reveal: Directive<HTMLElement, number | undefined> = {
  getSSRProps: () => ({ class: 'reveal' }),
  mounted(el, binding) {
    el.classList.add('reveal');
    if (binding.value) el.style.setProperty('--reveal-delay', `${binding.value}ms`);
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    (el as any)._revealIO = io;
  },
  unmounted(el) {
    (el as any)._revealIO?.disconnect();
  },
};

/** v-spotlight — a soft glow that follows the cursor across a card. */
const spotlight: Directive<HTMLElement> = {
  getSSRProps: () => ({ class: 'spotlight' }),
  mounted(el) {
    el.classList.add('spotlight');
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', move);
    (el as any)._spot = move;
  },
  unmounted(el) {
    el.removeEventListener('pointermove', (el as any)._spot);
  },
};

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.directive('reveal', reveal);
    app.directive('spotlight', spotlight);
    app.component('HomePage', HomePage);
    app.component('ActionFlow', ActionFlow);
    app.component('AgentTerminal', AgentTerminal);
    app.component('ContractPipeline', ContractPipeline);
    app.component('UseCaseGrid', UseCaseGrid);
    app.component('FlowSteps', FlowSteps);
    app.component('UseCaseHeader', UseCaseHeader);
    app.component('HeroPanel', HeroPanel);
    app.component('MIcon', Icon);
  },
} satisfies Theme;
