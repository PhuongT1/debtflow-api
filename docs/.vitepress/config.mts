import { resolve } from 'node:path';
import { sourceLinks } from './source-links.mts';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { excludeCommentsFromCopy } from './code-copy.mts';
import { watchCorePages } from './core-pages.mts';
import { createDocumentationNavigation } from './navigation.mts';

// Links to source code, Postman or the sibling web repo are valid in the repository and on GitHub,
// but VitePress cannot resolve them as site pages, and raw JSON is not a page either.
const outsideDocs = [
  /(?:\.\.\/)+(src|postman|prisma|scripts)(\/|$)/,
  /\.\.\/\.\.\/debtflow-web/,
  /openapi\.json$/,
];

const pageRewrites = {
  'README.md': 'index.md',
  'getting-started/running/index.md': 'getting-started/run-source.md',
  'getting-started/architecture/request-flow.md': 'getting-started/request-flow.md',
  'getting-started/architecture/party-architecture.md': 'getting-started/party-architecture.md',
  'database/migrations/index.md': 'database/initialize-empty.md',
  'database/migrations/order.md': 'database/migration-order.md',
  'database/users/create-user.md': 'database/create-user.md',
  'database/users/verify-user-access.md': 'database/verify-user-access.md',
  'database/local/change-schema.md': 'database/add-tables-fields.md',
  'database/local/index.md': 'database/new-developer.md',
  'database/schema/change-existing-fields.md': 'database/change-existing-fields.md',
  'database/schema/migration-failure.md': 'database/migration-failure.md',
  'database/schema/existing-database.md': 'database/existing-database.md',
  'development/source/project-structure.md': 'development/project-structure.md',
  'development/source/import-aliases.md': 'development/import-aliases.md',
  'development/http/api-and-swagger.md': 'development/api-and-swagger.md',
  'development/http/validation-and-errors.md': 'development/validation-and-errors.md',
  'development/persistence/persistence-architecture.md': 'development/persistence-architecture.md',
  'development/persistence/list-query.md': 'development/list-query.md',
};

export default withMermaid(
  defineConfig({
    title: 'DebtFlow API',
    description: 'Hướng dẫn kiến trúc, request flow, bảo trì và phát triển module DebtFlow API.',
    lang: 'vi-VN',
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]],
    cleanUrls: true,
    lastUpdated: true,
    ignoreDeadLinks: outsideDocs,
    // docs/README.md stays the GitHub landing page and becomes the site home.
    rewrites: pageRewrites,
    markdown: {
      config: (md) => sourceLinks(md, resolve(import.meta.dirname, '..'), pageRewrites),
      theme: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
      languageAlias: { env: 'ini' },
      codeTransformers: [excludeCommentsFromCopy()],
    },
    // Pre-bundle CommonJS deps that mermaid pulls in, otherwise the dev server shows a blank page.
    vite: {
      plugins: [watchCorePages()],
      optimizeDeps: { include: ['mermaid', 'fastdom', 'dayjs'] },
    },
    themeConfig: {
      ...createDocumentationNavigation(),
      logo: '/logo.svg',
      outlineTitle: 'Trong trang này',
      docFooter: { prev: 'Trang trước', next: 'Tiếp theo' },
      lastUpdated: { text: 'Cập nhật' },
      search: {
        provider: 'local',
        options: {
          miniSearch: { searchOptions: { prefix: true } },
          translations: {
            button: { buttonText: 'Tìm kiếm', buttonAriaLabel: 'Tìm trong tài liệu' },
            modal: {
              noResultsText: 'Không tìm thấy kết quả cho',
              resetButtonTitle: 'Xóa từ khóa',
              displayDetails: 'Hiện nội dung chi tiết',
              backButtonTitle: 'Đóng tìm kiếm',
              footer: { selectText: 'mở kết quả', navigateText: 'chọn kết quả', closeText: 'đóng' },
            },
          },
        },
      },
      outline: { level: [2, 3] },
      footer: {
        message: 'Guide cập nhật cùng code; API reference sinh bằng npm run docs:generate.',
      },
    },
  }),
);
