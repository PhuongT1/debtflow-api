import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { createDocumentationNavigation } from './navigation.mts';

// Links to source code, Postman or the sibling web repo are valid in the repository and on GitHub,
// but VitePress cannot resolve them as site pages, and raw JSON is not a page either.
const outsideDocs = [
  /(?:\.\.\/)+(src|postman|prisma|scripts)(\/|$)/,
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
