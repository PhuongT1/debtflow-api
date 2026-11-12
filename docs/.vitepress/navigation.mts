import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DefaultTheme } from 'vitepress';

type PageLink = { text: string; link: string; items?: PageLink[] };
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
  const coreRoot = resolve(docsRoot, '../.ai/core');
  const sections: DocSection[] = [
    {
      text: 'Bắt đầu',
      icon: 'start',
      description: 'Chạy dự án, hiểu kiến trúc và lần theo một request từ FE đến database.',
      link: '/getting-started/',
      prefixes: ['/getting-started/'],
      groups: [
        {
          text: 'Dev mới — đọc theo thứ tự',
          items: pages('/getting-started/', [
            ['run-source', '1. Chạy dự án'],
            ['architecture', '2. Kiến trúc backend'],
            ['request-flow', '3. Request từ FE đến DB'],
            ['party-architecture', '4. Ví dụ Party'],
            ['module-development', '5. Sửa và thêm module'],
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
          text: 'Chọn tình huống',
          items: pages('/database/', [
            ['configure-connection', 'Tạo DB và cấu hình URL'],
            ['initialize-empty', 'DB trống: tạo toàn bộ bảng'],
            ['add-tables-fields', 'Đưa bảng/field mới lên staging, production'],
            ['change-existing-fields', 'Đổi/xóa field có dữ liệu'],
            ['new-developer', 'Dev mới: cập nhật DB riêng'],
            ['data-changes', 'Dữ liệu demo, QA và backfill'],
            ['existing-database', 'DB có sẵn: baseline'],
            ['migration-failure', 'Migration lỗi hoặc drift'],
            ['overview', 'Tổng quan database'],
            ['party-indexes', 'Party indexes và DB tests'],
          ]).map((page) =>
            page.link === '/database/initialize-empty'
              ? {
                  ...page,
                  items: pages('/database/', [
                    ['migration-order', 'Migration: thứ tự chạy và kiểm tra'],
                  ]),
                }
              : page,
          ),
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
          text: 'Tra cứu khi làm task',
          items: [
            ...pages('/development/', [
              ['project-structure', 'Cấu trúc source'],
              ['persistence-architecture', 'Repository và transaction'],
              ['api-and-swagger', 'Swagger và API docs'],
              ['list-query', 'Filter, sort, phân trang'],
              ['authorization', 'Auth và tenant'],
              ['validation-and-errors', 'Validation và errors'],
              ['localization', 'Localization EN/VI'],
              ['audit-log', 'Audit log'],
              ['import-aliases', 'Import aliases và ESM'],
            ]),
            { text: 'Response format', link: '/guides/api-response-format' },
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
          text: 'Thiết lập và bảo trì',
          items: pages('/team/', [
            ['ai-setup', 'AI setup cho member'],
            ['ai-development', 'AI development workflow'],
            ['documentation', 'Sửa docs và rules đúng nguồn'],
            ['core/', 'Core rules: bắt đầu'],
          ]),
        },
        {
          text: 'DebtFlow backend rules',
          items: [
            { text: 'Bắt đầu với backend rules', link: '/guides/backend-rules/' },
            ...policyPages(resolve(docsRoot, 'guides/backend-rules'), '/guides/backend-rules/'),
          ],
        },
        ...['architecture', 'backend', 'workflow'].map((topic) => ({
          text: `Core — ${topic}`,
          items: policyPages(resolve(coreRoot, topic), `/team/core/${topic}/`),
        })),
      ],
    },
    {
      text: 'API & sản phẩm',
      icon: 'reference',
      description: 'Tra cứu endpoint, schema, nghiệp vụ và tài liệu được sinh từ code.',
      link: '/reference/',
      prefixes: ['/reference/', '/generated/'],
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
      ],
    },
    {
      text: 'Quyết định',
      icon: 'decisions',
      description: 'Hiểu lý do đằng sau kiến trúc qua ADR và các nguồn tham khảo.',
      link: '/adr/',
      prefixes: ['/adr/'],
      groups: [
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
    nav: sections.map((section) => ({
      text: section.text,
      link: section.link,
      activeMatch: `^(${section.prefixes.map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    })),
    sidebar,
  };
}
