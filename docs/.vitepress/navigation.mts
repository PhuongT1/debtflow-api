import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DefaultTheme } from 'vitepress';
import { readCorePages } from './core-pages.mts';

export type PageLink = { text: string; link?: string; items?: PageLink[] };
export type DocSection = {
  icon: string;
  description: string;
  text: string;
  link: string;
  prefixes: string[];
  groups: { text: string; items: PageLink[] }[];
};

const pages = (base: string, entries: [string, string][]): PageLink[] =>
  entries.map(([slug, text]) => ({ text, link: `${base}${slug}` }));

// Read policy titles and paths from their owners; newly added topics appear on the next reload/build.
function policyPages(directory: string, base: string): PageLink[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name }) => ({
      text: readFileSync(resolve(directory, name), 'utf8').match(/^# (.+)$/m)?.[1] ?? name,
      link: `${base}${name.slice(0, -3)}`,
    }));
}

export function createDocumentationNavigation() {
  const docsRoot = resolve(import.meta.dirname, '..');
  const corePages = readCorePages();
  const aiSetup: PageLink = {
    text: 'Áp dụng AI rules sau khi clone',
    link: '/team/ai-setup',
    items: pages('/team/ai-setup/', [
      ['choose-client', 'Kiểm tra AI đã nhận rules'],
      ['use-skills', 'Dùng skill theo công việc'],
      ['update-rules', 'Cập nhật và xử lý lỗi'],
      ['reuse-in-project', 'Mang rules sang dự án khác'],
    ]),
  };
  const sections: DocSection[] = [
    {
      text: 'Bắt đầu',
      icon: 'start',
      description: 'Thiết lập máy dev, chạy local, áp dụng AI rules và viết API.',
      link: '/getting-started/',
      prefixes: ['/getting-started/'],
      groups: [
        {
          text: 'Dev mới — đọc theo thứ tự',
          items: [
            {
              text: '1. Chạy dự án',
              link: '/getting-started/run-source',
              items: pages('/getting-started/running/', [
                ['local', 'Chạy local và debug'],
                ['troubleshooting', 'Xử lý lỗi khởi động'],
              ]),
            },
            { ...aiSetup, text: '2. Áp dụng AI rules sau khi clone' },
            {
              text: '3. Viết và bảo trì API',
              link: '/getting-started/module-development',
              items: [
                {
                  text: 'Sửa API đang có',
                  link: '/getting-started/module-development#maintain-existing-feature',
                },
                { text: 'Thêm module mới', link: '/getting-started/module-development#add-module' },
              ],
            },
          ],
        },
      ],
    },
    {
      text: 'Kiến trúc',
      icon: 'code',
      description: 'Clean Architecture, các layer và luồng API qua ví dụ Party thực tế.',
      link: '/getting-started/architecture',
      prefixes: [
        '/getting-started/architecture',
        '/getting-started/request-flow',
        '/getting-started/party-architecture',
      ],
      groups: [
        {
          text: 'Hiểu kiến trúc dự án',
          items: pages('/getting-started/', [
            ['architecture/clean-architecture', 'Clean Architecture và lý do lựa chọn'],
            ['request-flow', 'Luồng request từ FE đến DB'],
            ['party-architecture', 'Ví dụ thực tế: Party'],
          ]),
        },
      ],
    },
    {
      text: 'Database',
      icon: 'database',
      description: 'Tạo database, quản lý migration và phát hành thay đổi qua từng môi trường.',
      link: '/database/',
      prefixes: ['/database/'],
      groups: [
        {
          text: 'DB local — dành cho dev',
          items: [
            { text: 'Kết nối và chọn đúng môi trường', link: '/database/configure-connection' },
            {
              text: 'Cài và cập nhật DB dev riêng',
              link: '/database/new-developer',
              items: [{ text: 'Tạo migration khi thêm/sửa model', link: '/database/add-tables-fields' }],
            },
          ],
        },
        {
          text: 'DB staging và production',
          items: [
            {
              text: 'Chuẩn bị DB để phát hành',
              link: '/database/releases/',
              items: [
                { text: 'Kết nối DB với API và release runner', link: '/database/releases/connect-runtime' },
                {
                  text: 'Áp dụng migration: tạo mới và cập nhật DB',
                  link: '/database/initialize-empty',
                  items: pages('/database/', [
                    ['migration-order', '1. Chạy và kiểm tra migration'],
                  ]),
                },
                {
                  text: 'Tài khoản dev và kiểm thử',
                  link: '/database/create-user',
                  items: [{ text: 'Kiểm tra login và phân quyền', link: '/database/verify-user-access' }],
                },
              ],
            },
          ],
        },
        {
          text: 'Schema, dữ liệu và xử lý lỗi',
          items: [
            {
              text: 'Thay đổi schema có dữ liệu',
              link: '/database/change-existing-fields',
              items: pages('/database/', [
                ['migration-failure', 'Migration lỗi hoặc drift'],
                ['existing-database', 'DB có sẵn: baseline'],
              ]),
            },
            ...pages('/database/', [
              ['data-changes', 'Dữ liệu nghiệp vụ và backfill'],
              ['overview', 'Tổng quan database'],
              ['party-indexes', 'Party indexes và DB tests'],
            ]),
          ],
        },
      ],
    },
    {
      text: 'Phát triển',
      icon: 'code',
      description: 'Tìm đúng nơi sửa API, auth, validation, query và các thành phần dùng chung.',
      link: '/development/',
      prefixes: ['/development/', '/guides/api-response-format'],
      groups: [
        {
          text: 'Chọn phần cần sửa',
          items: [
            {
              text: 'Tổ chức source và imports',
              items: pages('/development/', [
                ['project-structure', 'Cấu trúc source'],
                ['import-aliases', 'Import aliases và ESM'],
              ]),
            },
            {
              text: 'Request, validation và response',
              items: [
                { text: 'Validation và errors', link: '/development/validation-and-errors' },
                { text: 'Response format', link: '/guides/api-response-format' },
                { text: 'Swagger và API docs', link: '/development/api-and-swagger' },
              ],
            },
            {
              text: 'Truy cập dữ liệu',
              items: pages('/development/', [
                ['persistence-architecture', 'Repository và transaction'],
                ['list-query', 'Filter, sort, phân trang'],
              ]),
            },
            ...pages('/development/', [
              ['authorization', 'Auth và tenant'],
              ['audit-log', 'Audit log'],
              ['localization', 'Localization EN/VI'],
            ]),
          ],
        },
      ],
    },
    {
      text: 'Rules & AI',
      icon: 'rules',
      description: 'Quy tắc của team, core NestJS và cách thiết lập AI để cùng làm đúng.',
      link: '/team/',
      prefixes: ['/team/', '/guides/backend-rules/'],
      groups: [
        {
          text: 'Áp dụng đúng nguồn',
          items: [
            aiSetup,
            { text: 'Tìm rules theo công việc', link: '/team/ai-development' },
            { text: 'Bảo trì tài liệu và rules', link: '/team/documentation' },
          ],
        },
        {
          text: 'Quy tắc bắt buộc',
          items: [
            {
              text: 'Core NestJS dùng chung',
              link: '/team/core/',
              items: ['architecture', 'backend', 'workflow'].map((topic) => ({
                text: {
                  architecture: 'Kiến trúc và tái sử dụng',
                  backend: 'API, bảo mật và dữ liệu',
                  workflow: 'Testing và verification',
                }[topic]!,
                items: corePages
                  .filter((page) => page.topic.startsWith(`${topic}/`))
                  .map(({ title, link }) => ({ text: title, link })),
              })),
            },
            {
              text: 'Quy tắc DebtFlow',
              link: '/guides/backend-rules/',
              items: policyPages(
                resolve(docsRoot, 'guides/backend-rules'),
                '/guides/backend-rules/',
              ),
            },
          ],
        },
      ],
    },
    {
      text: 'Triển khai',
      icon: 'decisions',
      description: 'CI kiểm tra gì, CD phát hành thế nào và vận hành staging/production.',
      link: '/deployment/',
      prefixes: ['/deployment/'],
      groups: [
        {
          text: 'CI — kiểm tra trước khi merge',
          items: [
            {
              text: 'CI hiện có và các quality gates',
              link: '/deployment/ci/',
              items: pages('/deployment/ci/', [
                ['pull-requests', 'Bảo vệ nhánh và xử lý CI lỗi'],
              ]),
            },
          ],
        },
        {
          text: 'CD — phát hành ứng dụng',
          items: [
            {
              text: 'Quy trình phát hành',
              link: '/deployment/cd/',
              items: [
                { text: '1. Triển khai staging', link: '/deployment/environments/staging' },
                {
                  text: '2. Phát hành production',
                  link: '/deployment/environments/production',
                  items: [{ text: 'Thêm, đổi, xóa field/bảng: thứ tự code và DB', link: '/deployment/environments/schema-changes' }],
                },
              ],
            },
            {
              text: 'Chọn nền tảng triển khai',
              items: pages('/deployment/platforms/', [
                ['vercel', 'Vercel: nhánh, env và chặn phát hành'],
                ['docker', 'Docker và host Node'],
              ]),
            },
            { text: 'Kiểm tra, theo dõi và rollback', link: '/deployment/cd/operations' },
          ],
        },
      ],
    },
    {
      text: 'Tra cứu',
      icon: 'reference',
      description: 'Tra cứu endpoint, schema, nghiệp vụ và tài liệu được sinh từ code.',
      link: '/reference/',
      prefixes: ['/reference/', '/generated/', '/adr/'],
      groups: [
        {
          text: 'Nguồn tra cứu',
          items: [
            ...pages('/reference/', [
              ['overview', 'Tổng quan sản phẩm'],
              ['business-rules', 'Business rules'],
            ]),
            ...pages('/generated/', [
              ['endpoints', 'Danh sách endpoint'],
              ['api-reference', 'API reference'],
              ['database', 'Database dictionary'],
            ]),
          ],
        },
        {
          text: 'ADR và nguồn tham khảo',
          items: pages('/adr/', [
            ['vendure-reference', 'Vendure reference'],
            ['0001-tenant-isolation-by-organization-id', 'ADR 0001: Tenant isolation'],
            ['0002-docs-as-code-with-generated-reference', 'ADR 0002: Docs as code'],
            ['0003-list-query-modeled-on-vendure', 'ADR 0003: List query'],
            ['0004-audit-log-through-domain-events', 'ADR 0004: Audit events'],
          ]),
        },
      ],
    },
  ];
  const sidebar: DefaultTheme.SidebarMulti = {};
  for (const section of sections) {
    const groups = [
      { text: section.text, items: [{ text: 'Tổng quan', link: section.link }] },
      ...section.groups,
    ];
    for (const prefix of section.prefixes) sidebar[prefix] = groups;
  }
  return {
    docSections: sections,
    nav: sections.map((section) => {
      const escape = (prefix: string) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nested = sections
        .filter((other) => other !== section)
        .flatMap((other) => other.prefixes)
        .filter((prefix) => section.prefixes.some((base) => prefix.startsWith(base)));
      const exclude = nested.length ? `(?!${nested.map(escape).join('|')})` : '';
      return {
        text: section.text,
        link: section.link,
        activeMatch: `^${exclude}(${section.prefixes.map(escape).join('|')})`,
      };
    }),
    // VitePress sorts by slash depth; insert specific routes first to resolve equal-depth keys.
    sidebar: Object.fromEntries(Object.entries(sidebar).sort(([a], [b]) => b.length - a.length)),
  };
}
