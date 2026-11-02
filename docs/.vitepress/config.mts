import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

// Links to source code, Postman or the sibling web repo are valid in the repository and on GitHub,
// but VitePress cannot resolve them as site pages, and raw JSON is not a page either.
const outsideDocs = [
  /\.\.\/(src|postman|prisma|scripts)(\/|$)/,
  /\.\.\/\.\.\/debtflow-web/,
  /openapi\.json$/,
];

export default withMermaid(
  defineConfig({
    title: 'DebtFlow API',
    description:
      'Product, architecture, business rules, database and API reference for DebtFlow API.',
    lang: 'en-US',
    cleanUrls: true,
    lastUpdated: true,
    ignoreDeadLinks: outsideDocs,
    // docs/README.md stays the GitHub landing page and becomes the site home.
    rewrites: { 'README.md': 'index.md' },
    markdown: { languageAlias: { env: 'ini' } },
    // Pre-bundle CommonJS deps that mermaid pulls in, otherwise the dev server shows a blank page.
    vite: { optimizeDeps: { include: ['mermaid', 'fastdom', 'dayjs'] } },
    themeConfig: {
      nav: [
        { text: 'Overview', link: '/01-overview' },
        { text: 'Architecture', link: '/02-architecture' },
        { text: 'API Reference', link: '/generated/api-reference' },
        { text: 'Database', link: '/04-database' },
      ],
      sidebar: [
        {
          text: 'Start here',
          items: [
            { text: 'Documentation home', link: '/' },
            { text: '1. Product Overview', link: '/01-overview' },
            { text: '2. Architecture', link: '/02-architecture' },
            { text: '3. Business Rules', link: '/03-business-rules' },
            { text: '4. Database', link: '/04-database' },
          ],
        },
        {
          text: 'Reference (generated)',
          items: [
            { text: 'API Reference', link: '/generated/api-reference' },
            { text: 'Database ERD & dictionary', link: '/generated/database' },
          ],
        },
        {
          text: 'Guides',
          items: [
            { text: 'Run Source', link: '/guides/run-source' },
            { text: 'API And Swagger', link: '/guides/api-and-swagger' },
            { text: 'API Response Format', link: '/guides/api-response-format' },
            { text: 'List Query (sort & filter)', link: '/guides/list-query' },
            { text: 'Localization (EN / VI)', link: '/guides/localization' },
            { text: 'Audit Log', link: '/guides/audit-log' },
            { text: 'Vendure Reference', link: '/guides/vendure-reference' },
            { text: 'AI Backend Development', link: '/guides/ai-development' },
            { text: 'Team AI Setup & Portable Core', link: '/guides/ai-setup' },
            {
              text: 'Backend Rules',
              items: [
                { text: 'Rule Index & Enforcement', link: '/guides/backend-rules/' },
                {
                  text: 'Vendure API Source Map',
                  link: '/guides/backend-rules/vendure-source-map',
                },
                { text: 'Ownership & Naming', link: '/guides/backend-rules/ownership-naming' },
                { text: 'Maintainability & Reuse', link: '/guides/backend-rules/maintainability' },
                { text: 'HTTP Contract', link: '/guides/backend-rules/http-contract' },
                { text: 'Validation', link: '/guides/backend-rules/validation' },
                { text: 'Security & Tenancy', link: '/guides/backend-rules/security-tenancy' },
                {
                  text: 'Services & Persistence',
                  link: '/guides/backend-rules/services-persistence',
                },
                { text: 'Queries', link: '/guides/backend-rules/queries' },
                { text: 'Events & Errors', link: '/guides/backend-rules/events-errors' },
                { text: 'Testing & Completion', link: '/guides/backend-rules/testing-completion' },
              ],
            },
            { text: 'Request Flow', link: '/guides/request-flow' },
            { text: 'Database Workflow', link: '/guides/database-workflow' },
            { text: 'Project Structure', link: '/guides/project-structure' },
            { text: 'Authentication & Authorization', link: '/guides/authorization' },
            { text: 'Validation & Errors', link: '/guides/validation-and-errors' },
            { text: 'Import Aliases', link: '/guides/import-aliases' },
          ],
        },
        {
          text: 'Decisions (ADR)',
          items: [
            {
              text: '0001 Tenant isolation',
              link: '/adr/0001-tenant-isolation-by-organization-id',
            },
            {
              text: '0002 Docs as code',
              link: '/adr/0002-docs-as-code-with-generated-reference',
            },
            { text: '0003 List query (Vendure)', link: '/adr/0003-list-query-modeled-on-vendure' },
            { text: '0004 Audit via events', link: '/adr/0004-audit-log-through-domain-events' },
          ],
        },
      ],
      search: { provider: 'local' },
      outline: { level: [2, 3] },
      footer: { message: 'Generated pages are rebuilt with npm run docs:generate.' },
    },
  }),
);
