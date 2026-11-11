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
    description: 'Hướng dẫn kiến trúc, request flow, bảo trì và phát triển module DebtFlow API.',
    lang: 'vi-VN',
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
        {
          text: 'Bắt đầu',
          link: '/',
        },
        {
          text: 'Kiến trúc',
          link: '/02-architecture',
        },
        {
          text: 'Request flow',
          link: '/guides/request-flow',
        },
        {
          text: 'API reference',
          link: '/generated/endpoints',
        },
      ],
      sidebar: [
        {
          text: 'Dev mới — đọc theo thứ tự',
          items: [
            {
              text: 'Bắt đầu tại đây',
              link: '/',
            },
            {
              text: '1. Chạy dự án',
              link: '/guides/run-source',
            },
            {
              text: '2. Kiến trúc backend',
              link: '/02-architecture',
            },
            {
              text: '3. Request từ FE đến DB',
              link: '/guides/request-flow',
            },
            {
              text: '4. Ví dụ: module Party',
              link: '/guides/party-architecture',
            },
            {
              text: '5. Sửa và thêm module',
              link: '/guides/module-development',
            },
          ],
        },
        {
          text: 'Tra cứu khi làm task',
          collapsed: true,
          items: [
            {
              text: 'Cấu trúc source',
              link: '/guides/project-structure',
            },
            {
              text: 'Repository và transaction',
              link: '/guides/persistence-architecture',
            },
            {
              text: 'Swagger và API docs',
              link: '/guides/api-and-swagger',
            },
            {
              text: 'Response format',
              link: '/guides/api-response-format',
            },
            {
              text: 'Filter, sort, phân trang',
              link: '/guides/list-query',
            },
            {
              text: 'Auth và tenant',
              link: '/guides/authorization',
            },
            {
              text: 'Validation và errors',
              link: '/guides/validation-and-errors',
            },
            {
              text: 'Database workflow',
              link: '/guides/database-workflow',
            },
            {
              text: 'Localization EN/VI',
              link: '/guides/localization',
            },
            {
              text: 'Audit log',
              link: '/guides/audit-log',
            },
            {
              text: 'Import aliases và ESM',
              link: '/guides/import-aliases',
            },
          ],
        },
        {
          text: 'Quy tắc team và AI',
          collapsed: true,
          items: [
            {
              text: 'AI setup cho member',
              link: '/guides/ai-setup',
            },
            {
              text: 'AI development workflow',
              link: '/guides/ai-development',
            },
            {
              text: 'Backend rules: bắt đầu',
              link: '/guides/backend-rules/',
            },
            {
              text: 'Ownership và naming',
              link: '/guides/backend-rules/ownership-naming',
            },
            {
              text: 'Maintainability và reuse',
              link: '/guides/backend-rules/maintainability',
            },
            {
              text: 'HTTP contract',
              link: '/guides/backend-rules/http-contract',
            },
            {
              text: 'Validation',
              link: '/guides/backend-rules/validation',
            },
            {
              text: 'Security và tenancy',
              link: '/guides/backend-rules/security-tenancy',
            },
            {
              text: 'Services và persistence',
              link: '/guides/backend-rules/services-persistence',
            },
            {
              text: 'Query rules',
              link: '/guides/backend-rules/queries',
            },
            {
              text: 'Events và errors',
              link: '/guides/backend-rules/events-errors',
            },
            {
              text: 'Testing và completion',
              link: '/guides/backend-rules/testing-completion',
            },
          ],
        },
        {
          text: 'Sản phẩm và API reference',
          collapsed: true,
          items: [
            {
              text: 'Tổng quan sản phẩm',
              link: '/01-overview',
            },
            {
              text: 'Business rules',
              link: '/03-business-rules',
            },
            {
              text: 'Database overview',
              link: '/04-database',
            },
            {
              text: 'Danh sách endpoint',
              link: '/generated/endpoints',
            },
            {
              text: 'API reference (generated)',
              link: '/generated/api-reference',
            },
            {
              text: 'Database dictionary (generated)',
              link: '/generated/database',
            },
          ],
        },
        {
          text: 'Quyết định và nguồn tham khảo',
          collapsed: true,
          items: [
            {
              text: 'Vendure reference',
              link: '/guides/vendure-reference',
            },
            {
              text: 'Vendure source evidence',
              link: '/guides/backend-rules/vendure-source-map',
            },
            {
              text: 'ADR 0001: Tenant isolation',
              link: '/adr/0001-tenant-isolation-by-organization-id',
            },
            {
              text: 'ADR 0002: Docs as code',
              link: '/adr/0002-docs-as-code-with-generated-reference',
            },
            {
              text: 'ADR 0003: List query',
              link: '/adr/0003-list-query-modeled-on-vendure',
            },
            {
              text: 'ADR 0004: Audit events',
              link: '/adr/0004-audit-log-through-domain-events',
            },
          ],
        },
      ],
      search: { provider: 'local' },
      outline: { level: [2, 3] },
      footer: {
        message: 'Guide cập nhật cùng code; API reference sinh bằng npm run docs:generate.',
      },
    },
  }),
);
