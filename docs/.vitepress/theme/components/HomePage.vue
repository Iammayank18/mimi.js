<script setup lang="ts">
import { ref } from 'vue';
import { withBase } from 'vitepress';
import Icon from './Icon.vue';
import HeroPanel from './HeroPanel.vue';

const managers = [
  { id: 'npm', cmd: 'npm install mimi.js zod' },
  { id: 'pnpm', cmd: 'pnpm add mimi.js zod' },
  { id: 'yarn', cmd: 'yarn add mimi.js zod' },
  { id: 'bun', cmd: 'bun add mimi.js zod' },
];
const pm = ref(0);
const copied = ref(false);
function copy() {
  navigator.clipboard?.writeText(managers[pm.value].cmd).then(() => {
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  });
}

const clients = ['Claude', 'ChatGPT', 'Cursor', 'VS Code', 'Windsurf', 'Zed', 'Your own agents'];

const capabilities = [
  { icon: 'plan', title: 'Dry-run plans', text: 'Any action can show its side effects, cost and approval needs before it runs.', link: '/guide/agent-native#_2-dry-run-plan-mode' },
  { icon: 'shield', title: 'Human approval', text: 'Risky calls are parked with their exact plan. A person approves; that exact call runs.', link: '/guide/agent-native#_4-approval-gates-human-in-the-loop' },
  { icon: 'retry', title: 'Safe retries', text: 'Idempotency keys and automatic de-duplication. A retry never charges a card twice.', link: '/guide/agent-native#_3-idempotency-built-in' },
  { icon: 'wrench', title: 'Recoverable errors', text: 'RFC 9457 problems with a fix, a valid example and what to call instead.', link: '/guide/agent-native#_5-errors-agents-can-recover-from' },
  { icon: 'undo', title: 'Receipts and undo', text: 'Every write returns a receipt. Reversible actions roll back in one call.', link: '/guide/agent-native#_6-receipts-and-undo' },
  { icon: 'wallet', title: 'Per-agent budgets', text: 'Rate and spend limits per agent. Going over budget becomes an approval, not a failure.', link: '/guide/agent-native#_7-caller-identity-budgets-and-audit' },
  { icon: 'search', title: 'Intent search', text: 'Agents find the right action by describing the task, so large APIs stay usable.', link: '/guide/agent-native#_9-progressive-disclosure-for-big-apis' },
  { icon: 'plug', title: 'Plugins', text: 'Hook every call, add MCP tools and routes, swap storage, identity and search.', link: '/guide/agent-plugins' },
  { icon: 'eye', title: 'Audit and insights', text: 'Every agent call is logged. Insights show where agents struggle with your API.', link: '/guide/agent-native#_10-agent-dx-insights' },
];

const stats = [
  { value: '89.5k', unit: 'req/s', label: 'Simple route, single process' },
  { value: '4×', unit: '', label: 'Throughput of Express 4' },
  { value: '1', unit: 'definition', label: 'REST, MCP, OpenAPI and llms.txt' },
  { value: '0', unit: 'deps', label: 'Added for the MCP server' },
];

const bench = [
  { name: 'mimi.js', value: 89504, hi: true },
  { name: 'Fastify', value: 94060 },
  { name: 'Express', value: 20414 },
];
</script>

<template>
  <div class="home">
    <!-- HERO -->
    <section class="frame hero-frame">
      <div class="hero">
        <div class="hero-copy">
          <a v-reveal class="announce no-underline" :href="withBase('/guide/agent-native')">
            <span class="tag">New</span>
            Agent-native actions · MCP built in
            <Icon name="arrow" :size="14" />
          </a>
          <h1 v-reveal="60">
            The API framework<br />
            for humans <span class="accent nowrap">and AI agents</span>
          </h1>
          <p v-reveal="120" class="lead">
            Define an endpoint once. mimi.js serves it as REST for your apps and as an MCP tool for Claude, ChatGPT and
            Cursor — with dry-run plans, human approval, safe retries and undo built in.
          </p>
          <div v-reveal="180" class="actions">
            <a class="btn solid no-underline" :href="withBase('/guide/getting-started')">
              Get started <Icon name="arrow" :size="16" />
            </a>
            <a class="btn outline no-underline" :href="withBase('/guide/use-cases')">Explore use cases</a>
          </div>
          <div v-reveal="240" class="install">
            <div class="pm">
              <button v-for="(m, i) in managers" :key="m.id" :class="{ on: pm === i }" @click="pm = i">{{ m.id }}</button>
            </div>
            <div class="cmd">
              <code><span class="dollar">$</span> {{ managers[pm].cmd }}</code>
              <button class="copy" :aria-label="`Copy ${managers[pm].cmd}`" @click="copy">
                <Icon :name="copied ? 'check' : 'copy'" :size="15" />
              </button>
            </div>
          </div>
        </div>
        <div v-reveal="120" class="visual">
          <HeroPanel />
        </div>
      </div>
    </section>

    <!-- CLIENTS -->
    <section class="frame clients">
      <span class="m-eyebrow">Works with any MCP client</span>
      <ul>
        <li v-for="c in clients" :key="c">{{ c }}</li>
      </ul>
    </section>

    <!-- ONE DEFINITION -->
    <section class="frame block">
      <header v-reveal class="head">
        <span class="m-eyebrow">01 · Define once</span>
        <h2>One action. Every surface.</h2>
        <p>Your apps get a clean REST API. Agents get an MCP server, a manifest and llms.txt. You maintain one definition.</p>
      </header>
      <ActionFlow v-reveal="80" />
    </section>

    <!-- CAPABILITIES -->
    <section class="frame block flush">
      <header v-reveal class="head pad">
        <span class="m-eyebrow">02 · Built in</span>
        <h2>Designed for callers that make mistakes</h2>
        <p>Agents retry, guess and occasionally get tricked. mimi.js handles that at the framework level, so your handlers stay simple.</p>
      </header>
      <div class="cells">
        <a
          v-for="(c, i) in capabilities"
          :key="c.title"
          v-reveal="(i % 3) * 60"
          v-spotlight
          class="cell no-underline"
          :href="withBase(c.link)"
        >
          <span class="cell-icon"><Icon :name="c.icon" :size="18" /></span>
          <h3>{{ c.title }}</h3>
          <p>{{ c.text }}</p>
          <span class="cell-more">Learn more <Icon name="arrow" :size="13" /></span>
        </a>
      </div>
    </section>

    <!-- CONTRACT -->
    <section class="frame block">
      <header v-reveal class="head">
        <span class="m-eyebrow">03 · One request path</span>
        <h2>Every call follows the same contract</h2>
        <p>REST, MCP or in-process — validation, policy, approval, idempotency and receipts behave identically.</p>
      </header>
      <ContractPipeline v-reveal="80" />
    </section>

    <!-- TERMINAL -->
    <section class="frame block">
      <div class="split">
        <header v-reveal class="head left">
          <span class="m-eyebrow">04 · In practice</span>
          <h2>An agent placing an order, safely</h2>
          <p>
            It previews the charge, retries without double-charging, waits for a person on a large refund and can undo
            its own mistakes.
          </p>
          <a class="text-link no-underline" :href="withBase('/guide/use-cases#ai-shopping-assistant')">
            Read the use case <Icon name="arrow" :size="14" />
          </a>
        </header>
        <AgentTerminal v-reveal="100" />
      </div>
    </section>

    <!-- USE CASES -->
    <section class="frame block flush">
      <header v-reveal class="head pad">
        <span class="m-eyebrow">05 · Use cases</span>
        <h2>What teams build with it</h2>
      </header>
      <UseCaseGrid :limit="6" variant="cells" />
      <div class="cells-foot">
        <a class="text-link no-underline" :href="withBase('/guide/use-cases')">All use cases with code <Icon name="arrow" :size="14" /></a>
      </div>
    </section>

    <!-- STATS -->
    <section class="frame stats">
      <div v-for="(s, i) in stats" :key="s.label" v-reveal="i * 60" class="stat">
        <div class="num">{{ s.value }}<span v-if="s.unit" class="unit">{{ s.unit }}</span></div>
        <div class="label">{{ s.label }}</div>
      </div>
    </section>

    <!-- FRAMEWORK -->
    <section class="frame block">
      <div class="split">
        <div v-reveal class="head left">
          <span class="m-eyebrow">06 · Still a fast framework</span>
          <h2>Express ergonomics, near&#8209;Fastify speed</h2>
          <p>The same <code>req</code>/<code>res</code> API you know, a radix-tree router, auto-loaded routes, Zod validation with OpenAPI, and auth and database helpers included.</p>
          <ul class="checks">
            <li><Icon name="check" :size="16" /> Existing Express middleware works</li>
            <li><Icon name="check" :size="16" /> Swagger UI generated from Zod schemas</li>
            <li><Icon name="check" :size="16" /> JWT, bcrypt, MongoDB and SQLite helpers</li>
            <li><Icon name="check" :size="16" /> Routes load from a <code>routes/</code> folder</li>
          </ul>
        </div>
        <div v-reveal="100" class="m-card bench">
          <div class="bench-head">
            <span>Requests per second</span>
            <span class="muted">autocannon · 100 connections · 10s</span>
          </div>
          <div v-for="b in bench" :key="b.name" class="row">
            <span class="name" :class="{ hi: b.hi }">{{ b.name }}</span>
            <div class="track"><div class="fill" :class="{ hi: b.hi }" :style="{ '--w': (b.value / 94060) * 100 + '%' }" /></div>
            <span class="val">{{ b.value.toLocaleString('en-US') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="frame cta">
      <div class="cta-grid" aria-hidden="true" />
      <div v-reveal class="cta-inner">
        <h2>Make your API ready for agents.</h2>
        <p>Install mimi.js, define your first action and connect any MCP client to <code>/mcp</code>.</p>
        <div class="actions center">
          <a class="btn solid no-underline" :href="withBase('/guide/agent-native')">Read the guide <Icon name="arrow" :size="16" /></a>
          <a class="btn outline no-underline" href="https://github.com/Iammayank18/mimi.js"><Icon name="github" :size="16" /> GitHub</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home { padding: 0 24px; }

/* Framed layout: vertical guide lines + section hairlines + corner marks */
.frame {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  border-left: 1px solid var(--m-line);
  border-right: 1px solid var(--m-line);
  border-bottom: 1px solid var(--m-line);
}
.frame::before,
.frame::after {
  content: '';
  position: absolute;
  bottom: -6px;
  width: 11px;
  height: 11px;
  background:
    linear-gradient(var(--m-line-strong), var(--m-line-strong)) center / 1px 100% no-repeat,
    linear-gradient(var(--m-line-strong), var(--m-line-strong)) center / 100% 1px no-repeat;
  z-index: 1;
}
.frame::before { left: -6px; }
.frame::after { right: -6px; }

/* HERO */
.hero-frame { border-bottom: 1px solid var(--m-line); }
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: center;
  padding: 88px 48px 72px;
}
.hero > * { min-width: 0; }
.announce {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  transition: border-color 0.2s, color 0.2s;
}
.announce:hover { border-color: var(--m-line-strong); color: var(--vp-c-text-1); }
.announce .tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.announce :deep(.icon) { transition: transform 0.2s var(--m-ease); }
.announce:hover :deep(.icon) { transform: translateX(2px); }
h1 {
  margin: 24px 0 20px;
  font-size: clamp(2.4rem, 4.6vw, 3.6rem);
  line-height: 1.08;
  letter-spacing: -0.035em;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.accent { color: var(--vp-c-brand-1); }
.nowrap { white-space: nowrap; }
.lead {
  margin: 0;
  max-width: 540px;
  font-size: 1.075rem;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 32px; }
.actions.center { justify-content: center; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border-radius: 10px;
  font-size: 14.5px;
  font-weight: 500;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}
.btn.solid { background: var(--vp-c-text-1); color: var(--vp-c-bg); }
.btn.solid:hover { opacity: 0.88; }
.btn.solid :deep(.icon) { transition: transform 0.2s var(--m-ease); }
.btn.solid:hover :deep(.icon) { transform: translateX(2px); }
.btn.outline { border: 1px solid var(--m-line-strong); color: var(--vp-c-text-1); background: var(--m-surface); }
.btn.outline:hover { border-color: var(--vp-c-text-3); }

.install { margin-top: 28px; max-width: 420px; }
.pm { display: flex; gap: 2px; margin-bottom: 8px; }
.pm button {
  padding: 3px 9px;
  border-radius: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  transition: color 0.15s, background 0.15s;
}
.pm button:hover { color: var(--vp-c-text-1); }
.pm button.on { color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); }
.cmd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--m-line);
  background: var(--m-surface);
}
.cmd code { background: none; border: 0; padding: 0; font-family: var(--vp-font-family-mono); font-size: 13.5px; color: var(--vp-c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dollar { color: var(--vp-c-text-3); margin-right: 4px; }
.copy {
  display: grid; place-items: center;
  width: 28px; height: 28px; border-radius: 6px;
  color: var(--vp-c-text-3);
  transition: color 0.15s, background 0.15s;
}
.copy:hover { color: var(--vp-c-text-1); background: var(--vp-c-bg-soft); }

/* CLIENTS */
.clients {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 22px 48px;
  flex-wrap: wrap;
}
.clients ul { display: flex; flex-wrap: wrap; gap: 8px 28px; margin: 0; padding: 0; list-style: none; }
.clients li { font-size: 15px; font-weight: 500; color: var(--vp-c-text-2); letter-spacing: -0.01em; }

/* SECTIONS */
.block { padding: 96px 48px; }
.block.flush { padding: 96px 0 0; }
.head { max-width: 680px; margin: 0 auto 48px; text-align: center; }
.head.pad { padding: 0 48px; }
.head.left { text-align: left; margin: 0; }
.head h2 {
  margin: 14px 0 0;
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.head p { margin: 14px 0 0; font-size: 1.02rem; line-height: 1.7; color: var(--vp-c-text-2); }
.head code, .checks code { font-size: 0.88em; padding: 0.1em 0.35em; border-radius: 4px; background: var(--vp-c-bg-soft); border: 1px solid var(--m-line); }
.split { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 56px; align-items: center; }
.split > * { min-width: 0; }
.text-link {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 22px;
  font-size: 14.5px; font-weight: 500;
  color: var(--vp-c-text-1);
}
.text-link :deep(.icon) { transition: transform 0.2s var(--m-ease); }
.text-link:hover :deep(.icon) { transform: translateX(3px); }

/* Capability cells — hairline grid */
.cells {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--m-line);
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 32px;
  border-right: 1px solid var(--m-line);
  border-bottom: 1px solid var(--m-line);
  color: inherit;
  transition: background 0.2s;
}
.cell:nth-child(3n) { border-right: 0; }
.cells .cell:nth-last-child(-n + 3) { border-bottom: 0; }
.cell-icon {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 9px;
  border: 1px solid var(--m-line);
  background: var(--m-surface);
  color: var(--vp-c-text-1);
}
.cell h3 { margin: 20px 0 6px; font-size: 15.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--vp-c-text-1); }
.cell p { margin: 0; font-size: 14px; line-height: 1.65; color: var(--vp-c-text-2); flex: 1; }
.cell-more {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 16px;
  font-size: 13px; font-weight: 500;
  color: var(--vp-c-text-3);
  transition: color 0.2s;
}
.cell-more :deep(.icon) { transition: transform 0.2s var(--m-ease); }
.cell:hover .cell-more { color: var(--vp-c-text-1); }
.cell:hover .cell-more :deep(.icon) { transform: translateX(3px); }
.cells-foot { padding: 22px 48px; border-top: 1px solid var(--m-line); text-align: center; }
.cells-foot .text-link { margin: 0; }

/* STATS */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); }
.stat { padding: 40px 32px; border-right: 1px solid var(--m-line); }
.stat:last-child { border-right: 0; }
.num { font-size: 2.5rem; font-weight: 600; letter-spacing: -0.04em; color: var(--vp-c-text-1); line-height: 1; font-variant-numeric: tabular-nums; }
.unit { font-size: 1rem; font-weight: 500; letter-spacing: 0; color: var(--vp-c-text-3); margin-left: 6px; }
.label { margin-top: 10px; font-size: 13.5px; color: var(--vp-c-text-2); }

/* FRAMEWORK */
.checks { list-style: none; margin: 24px 0 0; padding: 0; display: grid; gap: 10px; }
.checks li { display: flex; align-items: center; gap: 10px; font-size: 14.5px; color: var(--vp-c-text-1); }
.checks :deep(.icon) { color: var(--m-ok); }
.bench { padding: 28px; }
.bench-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 22px; font-size: 14px; font-weight: 600; color: var(--vp-c-text-1); }
.bench-head .muted { font-weight: 400; font-size: 12.5px; color: var(--vp-c-text-3); font-family: var(--vp-font-family-mono); }
.row { display: grid; grid-template-columns: 76px 1fr 70px; gap: 14px; align-items: center; margin: 16px 0; }
.name { font-size: 14px; color: var(--vp-c-text-2); }
.name.hi { color: var(--vp-c-text-1); font-weight: 600; }
.track { height: 8px; border-radius: 4px; background: var(--vp-c-bg-soft); overflow: hidden; }
.fill { height: 100%; width: 0; border-radius: 4px; background: var(--m-line-strong); transition: width 1.2s var(--m-ease) 0.15s; }
.fill.hi { background: var(--vp-c-brand-1); }
.is-visible .fill { width: var(--w); }
.val { text-align: right; font-family: var(--vp-font-family-mono); font-size: 12.5px; color: var(--vp-c-text-2); }

/* CTA */
.cta { overflow: hidden; padding: 112px 48px; text-align: center; }
.cta-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(to right, var(--m-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--m-grid) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, #000, transparent 75%);
  mask-image: radial-gradient(ellipse 60% 70% at 50% 50%, #000, transparent 75%);
}
.cta-inner { position: relative; }
.cta h2 { margin: 0; font-size: clamp(1.9rem, 3.4vw, 2.6rem); font-weight: 600; letter-spacing: -0.035em; color: var(--vp-c-text-1); }
.cta p { margin: 14px auto 0; max-width: 520px; color: var(--vp-c-text-2); font-size: 1.02rem; }
.cta code { font-size: 0.9em; padding: 0.1em 0.35em; border-radius: 4px; background: var(--vp-c-bg-soft); border: 1px solid var(--m-line); }

/* RESPONSIVE */
@media (max-width: 1024px) {
  .cells { grid-template-columns: repeat(2, 1fr); }
  .cell:nth-child(3n) { border-right: 1px solid var(--m-line); }
  .cell:nth-child(2n) { border-right: 0; }
  .cells .cell:nth-last-child(-n + 3) { border-bottom: 1px solid var(--m-line); }
  .cells .cell:last-child { border-bottom: 0; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .stat:nth-child(2) { border-right: 0; }
  .stat:nth-child(-n + 2) { border-bottom: 1px solid var(--m-line); }
}
@media (max-width: 960px) {
  .hero { grid-template-columns: 1fr; padding: 56px 28px 48px; gap: 40px; }
  .split { grid-template-columns: 1fr; gap: 40px; }
  .block { padding: 72px 28px; }
  .block.flush { padding: 72px 0 0; }
  .head.pad { padding: 0 28px; }
  .clients { padding: 20px 28px; gap: 14px; }
}
@media (max-width: 640px) {
  .home { padding: 0 12px; }
  .hero { padding: 40px 18px 40px; }
  .block { padding: 60px 18px; }
  .head.pad { padding: 0 18px; }
  .cells { grid-template-columns: 1fr; }
  .cell { border-right: 0 !important; padding: 24px 20px; }
  .cells .cell { border-bottom: 1px solid var(--m-line) !important; }
  .cells .cell:last-child { border-bottom: 0 !important; }
  .stat { padding: 26px 18px; }
  .num { font-size: 1.9rem; }
  .cta { padding: 72px 18px; }
  .clients ul { gap: 6px 18px; }
  .clients li { font-size: 14px; }
  .actions .btn { flex: 1 1 auto; justify-content: center; padding: 0 14px; white-space: nowrap; }
  .announce { font-size: 12.5px; }
  h1 { font-size: 2.15rem; }
}
</style>
