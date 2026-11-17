import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { resolve } from 'node:path';
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress';
import { sourceLinks } from '../../docs/.vitepress/source-links.mts';

const root = resolve('docs');
const md = await createMarkdownRenderer(root, {
  config: (md) =>
    sourceLinks(md, root, {
      'database/users/create-user.md': 'database/create-user.md',
    }),
});
after(() => disposeMdItInstance());

test('links resolve from the real Markdown folder rather than its rewritten public URL', () => {
  const html = md.render('[User](../users/create-user.md#role) [Config](../configure-connection.md)', {
    realPath: resolve(root, 'database/migrations/order.md'),
    path: resolve(root, 'database/migration-order.md'),
    cleanUrls: true,
  });
  assert.match(html, /href="\/database\/create-user#role"/);
  assert.match(html, /href="\/database\/configure-connection"/);
});

test('source links retain external URLs, anchors and repository file references', () => {
  const html = md.render('[API](https://example.com/api) [Here](#here) [Source](../../AGENTS.md)', {
    realPath: resolve(root, 'team/index.md'),
    cleanUrls: true,
  });
  assert.match(html, /href="https:\/\/example.com\/api"/);
  assert.match(html, /href="#here"/);
  assert.ok(!html.includes('href="/../AGENTS'));
});
