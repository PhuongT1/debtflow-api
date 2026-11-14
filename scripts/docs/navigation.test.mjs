import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readCorePages } from '../../docs/.vitepress/core-pages.mts';
import { createDocumentationNavigation } from '../../docs/.vitepress/navigation.mts';

const flatten = (items) => items.flatMap((item) => [item, ...flatten(item.items ?? [])]);

test('architecture has its own top menu and sidebar', () => {
  const { docSections, nav, sidebar } = createDocumentationNavigation();
  assert.deepEqual(
    nav.map(({ text }) => text),
    ['Bắt đầu', 'Kiến trúc', 'Database', 'Phát triển', 'Rules & AI', 'Triển khai', 'Tra cứu'],
  );
  const onboarding = docSections[0].groups[0].items;
  const architecture = docSections.find(({ text }) => text === 'Kiến trúc').groups[0];
  assert.ok(!onboarding.some(({ link }) => link === '/getting-started/architecture'));
  for (const path of ['/getting-started/architecture', '/getting-started/request-flow', '/getting-started/party-architecture']) {
    assert.deepEqual(nav.filter(({ activeMatch }) => new RegExp(activeMatch).test(path)).map(({ text }) => text), ['Kiến trúc']);
    const key = Object.keys(sidebar).sort((a, b) => b.split('/').length - a.split('/').length).find((prefix) => path.startsWith(prefix));
    assert.equal(sidebar[key][0].text, 'Kiến trúc');
  }
  assert.deepEqual(
    architecture.items.map(({ link }) => link),
    [
      '/getting-started/architecture/clean-architecture',
      '/getting-started/request-flow',
      '/getting-started/party-architecture',
    ],
  );
  assert.ok(onboarding.some(({ link }) => link === '/team/ai-setup'));
  assert.deepEqual(
    onboarding
      .find(({ link }) => link === '/getting-started/run-source')
      .items.map(({ link }) => link),
    ['local', 'troubleshooting'].map(
      (topic) => `/getting-started/running/${topic}`,
    ),
  );

  const database = flatten(
    docSections.find(({ link }) => link === '/database/').groups.flatMap(({ items }) => items),
  );
  assert.deepEqual(database.find(({ link }) => link === '/database/initialize-empty').items.map(({ link }) => link), ['/database/migration-order']);
  const accounts = database.find(({ link }) => link === '/database/create-user');
  assert.deepEqual(accounts.items.map(({ link }) => link), ['/database/verify-user-access']);
  assert.ok(
    flatten(docSections.at(-1).groups.flatMap(({ items }) => items)).some(({ link }) =>
      link.startsWith('/adr/'),
    ),
  );
});

test('every core menu entry comes from the same inventory as the routes', () => {
  const { docSections } = createDocumentationNavigation();
  const links = flatten(
    docSections.find(({ link }) => link === '/team/').groups.flatMap(({ items }) => items),
  ).map(({ link }) => link);
  for (const page of readCorePages()) assert.ok(links.includes(page.link), page.link);
  assert.match(readFileSync('docs/team/core/[topic].md', 'utf8'), /<!-- @content -->/);
});

test('core pages pick up source changes and new topics without a documentation copy', () => {
  const root = mkdtempSync(join(tmpdir(), 'debtflow-core-pages-'));
  try {
    for (const group of ['architecture', 'backend', 'workflow']) mkdirSync(join(root, group));
    writeFileSync(
      join(root, 'index.md'),
      '# Rules\n\n[Structure](./architecture/structure.md#owner)',
    );
    writeFileSync(join(root, 'architecture/structure.md'), '# Structure\n\nOriginal policy.');
    const first = readCorePages(root);
    assert.match(first[0].content, /\]\(\/team\/core\/architecture\/structure#owner\)/);
    writeFileSync(join(root, 'architecture/structure.md'), '# Structure\n\nUpdated policy.');
    writeFileSync(join(root, 'workflow/new-topic.md'), '# New workflow');
    const updated = readCorePages(root);
    assert.match(
      updated.find(({ topic }) => topic === 'architecture/structure').content,
      /Updated policy/,
    );
    assert.ok(updated.some(({ link }) => link === '/team/core/workflow/new-topic'));
    writeFileSync(join(root, 'index.md'), '# Rules\n\n[Missing](./backend/missing.md)');
    assert.throws(() => readCorePages(root), /Unknown core policy link/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test('AI onboarding shares a task-based tree with matching source pages', () => {
  const { docSections } = createDocumentationNavigation();
  const onboarding = docSections[0].groups[0].items.find(({ link }) => link === '/team/ai-setup');
  const team = docSections.find(({ link }) => link === '/team/').groups[0].items;
  const setup = team.find(({ link }) => link === '/team/ai-setup');
  assert.equal(setup.text, 'Áp dụng AI rules sau khi clone');
  assert.deepEqual(onboarding.items, setup.items);
  assert.deepEqual(setup.items.map(({ link }) => link),
    ['choose-client', 'use-skills', 'update-rules', 'reuse-in-project'].map(
      (slug) => `/team/ai-setup/${slug}`,
    ));
  for (const { link } of setup.items) {
    assert.match(readFileSync(`docs${link}.md`, 'utf8'), /^# /);
  }
  const guide = readFileSync('docs/team/ai-development.md', 'utf8');
  assert.ok(!guide.includes('#skills-and-sync'));
  assert.ok(guide.includes('./ai-setup/use-skills.md'));
});

test('release documentation owns deployment pages and stays separate from local onboarding', () => {
  const { docSections, nav, sidebar } = createDocumentationNavigation();
  const deployment = docSections.find(({ link }) => link === '/deployment/');
  const local = flatten(docSections[0].groups.flatMap(({ items }) => items));
  const release = flatten(deployment.groups.flatMap(({ items }) => items));
  for (const slug of ['staging', 'production']) {
    const link = `/deployment/environments/${slug}`;
    assert.ok(release.some((item) => item.link === link));
    assert.ok(!local.some((item) => item.link === link));
  }
  for (const { link } of release) {
    if (!link) continue;
    const file = link.endsWith('/') ? `docs${link}index.md` : `docs${link}.md`;
    assert.match(readFileSync(file, 'utf8'), /^# /);
    assert.deepEqual(nav.filter(({ activeMatch }) => new RegExp(activeMatch).test(link)).map(({ text }) => text), ['Triển khai']);
  }
  assert.equal(sidebar['/deployment/'][0].text, 'Triển khai');
});

test('database navigation separates local authoring from release preparation', () => {
  const { docSections } = createDocumentationNavigation();
  const database = docSections.find(({ link }) => link === '/database/');
  const local = flatten(database.groups.find(({ text }) => text === 'DB local — dành cho dev').items);
  const releases = flatten(database.groups.find(({ text }) => text === 'DB staging và production').items);
  assert.ok(local.some(({ link }) => link === '/database/add-tables-fields'));
  assert.ok(!local.some(({ link }) => link === '/database/initialize-empty'));
  assert.ok(releases.some(({ link }) => link === '/database/releases/connect-runtime'));
  assert.ok(releases.some(({ link }) => link === '/database/initialize-empty'));
  const deployment = flatten(docSections.find(({ link }) => link === '/deployment/').groups.flatMap(({ items }) => items));
  const production = deployment.find(({ link }) => link === '/deployment/environments/production');
  assert.ok(production.items.some(({ link }) => link === '/deployment/environments/schema-changes'));
  const config = readFileSync('docs/.vitepress/config.mts', 'utf8');
  assert.ok(config.includes("'database/local/index.md': 'database/new-developer.md'"));
  assert.ok(config.includes("'database/local/change-schema.md': 'database/add-tables-fields.md'"));
});
