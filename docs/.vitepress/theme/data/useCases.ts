export interface UseCase {
  id: string;
  /** Name of an icon in components/Icon.vue */
  icon: string;
  title: string;
  who: string;
  summary: string;
  uses: string[];
}

export const useCases: UseCase[] = [
  {
    id: 'ai-customer-support',
    icon: 'headset',
    title: 'AI customer support',
    who: 'Support teams',
    summary: 'A support bot looks up orders and issues refunds. Small ones go through; big ones wait for a human. Mistakes are undoable.',
    uses: ['approval', 'undo', 'redact'],
  },
  {
    id: 'ai-shopping-assistant',
    icon: 'cart',
    title: 'AI shopping assistant',
    who: 'E-commerce',
    summary: 'ChatGPT or Claude browses your catalog and checks out for the user — previewing totals first and never charging twice.',
    uses: ['dry-run', 'idempotency', 'budgets'],
  },
  {
    id: 'devops-agent',
    icon: 'server',
    title: 'DevOps & on-call agent',
    who: 'Platform teams',
    summary: 'An agent deploys, scales and rolls back. Production deploys show a plan and need approval; rollback is one undo.',
    uses: ['dry-run', 'approval', 'scopes'],
  },
  {
    id: 'fintech-payouts',
    icon: 'bank',
    title: 'Payouts & finance ops',
    who: 'Fintech',
    summary: 'Agents send vendor payouts inside strict daily budgets, with a permanent audit trail and humans-only account closure.',
    uses: ['budgets', 'audit', 'agents: deny'],
  },
  {
    id: 'saas-in-chatgpt',
    icon: 'grid',
    title: 'Your SaaS inside ChatGPT & Claude',
    who: 'B2B SaaS',
    summary: 'Expose 50+ actions of your product as one MCP server. Agents search by intent instead of drowning in tools.',
    uses: ['MCP', 'intent search', 'API keys'],
  },
  {
    id: 'sensitive-data',
    icon: 'heart',
    title: 'Clinics, HR & sensitive data',
    who: 'Regulated industries',
    summary: 'Agents book appointments without ever seeing PII, deletions stay human-only, and every action is logged.',
    uses: ['redact', 'requireUndo', 'audit'],
  },
  {
    id: 'marketing-agent',
    icon: 'send',
    title: 'Marketing & outreach agent',
    who: 'Growth teams',
    summary: 'Preview exactly who gets the email before sending. Big blasts need approval; double sends are impossible.',
    uses: ['dry-run', 'auto-dedupe', 'approval'],
  },
  {
    id: 'internal-automation',
    icon: 'terminal',
    title: 'Slack bots, cron jobs & internal tools',
    who: 'Back office',
    summary: 'Call the same actions in-process from a Slack bot or a job — same safety rules, no HTTP needed.',
    uses: ['kit.call()', 'plugins', 'custom tools'],
  },
];
