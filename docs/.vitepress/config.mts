import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'mimi.js',
  description: 'The Node.js API framework for humans and AI agents — Express-compatible, MCP built in, with dry-run, approvals and undo for every action.',
  base: '/mimi.js/',

  head: [
    ['link', { rel: 'icon', href: 'https://github.com/user-attachments/assets/6bb183ae-7ec1-4da9-95f2-85064f4deda0' }],
    ['meta', { name: 'theme-color', content: '#09090b' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap' }],
    ['meta', { property: 'og:title', content: 'mimi.js — the API framework for humans and AI agents' }],
    ['meta', { property: 'og:description', content: 'Write an endpoint once. Serve it as REST and an MCP tool, with dry-run plans, human approval, safe retries and undo built in.' }],
  ],

  themeConfig: {
    logo: 'https://github.com/user-attachments/assets/6bb183ae-7ec1-4da9-95f2-85064f4deda0',
    siteTitle: 'mimi.js',

    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '^/guide/(?!use-cases|agent-)' },
      { text: 'Use Cases', link: '/guide/use-cases', activeMatch: '/guide/use-cases' },
      { text: 'Agents', link: '/guide/agent-native', activeMatch: '/guide/agent-' },
      { text: 'Reference', link: '/reference/api-reference', activeMatch: '/reference/' },
      { text: 'Changelog', link: '/changelog' },
      {
        text: 'v2.0.5',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'npm', link: 'https://www.npmjs.com/package/mimi.js' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Agent-Native',
          items: [
            { text: 'Actions for humans & agents', link: '/guide/agent-native' },
            { text: 'Use cases', link: '/guide/use-cases' },
            { text: 'Customising & plugins', link: '/guide/agent-plugins' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Routing', link: '/guide/routing' },
            { text: 'Route Loader', link: '/guide/route-loader' },
            { text: 'Middleware', link: '/guide/middleware' },
            { text: 'Error Handling', link: '/guide/error-handling' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Authentication', link: '/guide/auth' },
            { text: 'Database', link: '/guide/database' },
            { text: 'Swagger / OpenAPI', link: '/guide/swagger' },
            { text: 'Plugins', link: '/guide/plugins' },
          ],
        },
        {
          text: 'Testing',
          items: [
            { text: 'Testing', link: '/guide/testing' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'API Reference', link: '/reference/api-reference' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Iammayank18/mimi.js' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/mimi.js' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/Iammayank18/mimi.js/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'medium',
      },
    },

    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2024–2026 Mayank Thakur',
    },

    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'one-dark-pro',
    },
    lineNumbers: true,
  },

  lastUpdated: true,
})

