import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createMarkdownRenderer, disposeMdItInstance } from 'vitepress';
import { excludeCommentsFromCopy } from '../../docs/.vitepress/code-copy.mts';

const md = await createMarkdownRenderer(process.cwd(), {
  languageAlias: { env: 'ini' },
  codeTransformers: [excludeCommentsFromCopy()],
});
after(() => disposeMdItInstance());

for (const [language, source, literal] of [
  ['bash', '# Explanation\nprintf "#value" # trailing', 'value'],
  ['sql', "-- Explanation\nSELECT '-- literal'; -- trailing", 'literal'],
  ['ts', '// Explanation\nconst url = "https://example.com"; // trailing', 'https://example.com'],
  ['env', '# Explanation\nVALUE="text#value"', 'text#value'],
]) {
  test(`${language}: hides comments from copy while retaining literal comment markers`, () => {
    const html = md.render(`\`\`\`${language}\n${source}\n\`\`\``);
    assert.match(html, /class="vp-copy-ignore">[^<]*Explanation/);
    const copyable = html.replace(/<span[^>]*class="vp-copy-ignore"[^>]*>[\s\S]*?<\/span>/g, '');
    assert.ok(copyable.includes(literal));
    assert.ok(!copyable.includes('Explanation'));
    assert.ok(!copyable.includes('trailing'));
    assert.match(html, /class="copy"/);
  });
}

test('shell heredoc data and shebang remain copyable', () => {
  const html = md.render("```bash\n#!/usr/bin/env bash\ncat <<'EOF'\n# literal data\nEOF\n```");
  assert.doesNotMatch(html, /class="vp-copy-ignore"/);
  assert.ok(html.includes('# literal data'));
});

test('removing a block comment leaves a token separator', () => {
  const html = md.render('```ts\nconst/* explanation */value = 1;\n```');
  const copyable = html
    .replace(/<span[^>]*class="vp-copy-ignore"[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '');
  assert.match(copyable, /const\s+value/);
});
