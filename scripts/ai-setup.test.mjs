import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { setupAi } from './ai-setup.mjs';

const core = fileURLToPath(new URL('../.ai/core', import.meta.url));
const installer = fileURLToPath(new URL('./ai-setup.mjs', import.meta.url));
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'nestjs-ai-'));
  const write = (name, content) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(
      join(root, name),
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  };
  cpSync(core, join(root, '.ai/core'), { recursive: true });
  write('package.json', {
    name: 'another-nest-api',
    scripts: { lint: 'eslint src', test: 'node --test', build: 'nest build' },
  });
  const read = (name) => readFileSync(join(root, name), 'utf8');
  const configure = (updates) => {
    const config = JSON.parse(read('.ai/project.json'));
    write('.ai/project.json', { ...config, ...updates });
  };
  try {
    run({ root, write, read, configure });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('copied core installs offline in a different project for all clients without DebtFlow assumptions', () =>
  fixture(({ root, read }) => {
    const result = setupAi(root, { init: true });
    assert.equal(result.skills, 3);
    for (const directory of ['.agents', '.claude', '.cursor']) {
      const content = read(`${directory}/skills/backend-change/SKILL.md`);
      assert.match(content, /NestJS/);
      assert.doesNotMatch(content, /DebtFlow|Prisma|OrganizationRole|org_legacy/);
    }
    assert.match(read('AGENTS.md'), /another-nest-api/);
    assert.match(read('CLAUDE.md'), /@AGENTS.md/);
    assert.match(read('.cursor/rules/team-nestjs.mdc'), /alwaysApply: true/);
    assert.match(read('.github/copilot-instructions.md'), /AGENTS.md/);
    assert.match(read('.ai/generated/project-context.md'), /npm run build/);
    assert.deepEqual(setupAi(root, { check: true }), { skills: 3, changed: 0 });
  }));

test('rerunning setup is idempotent and check performs no writes', () =>
  fixture(({ root, read }) => {
    setupAi(root, { init: true });
    const before = read('.ai/local-state.json');
    const mtime = statSync(join(root, 'CLAUDE.md')).mtimeMs;
    assert.equal(setupAi(root).changed, 0);
    setupAi(root, { check: true });
    assert.equal(read('.ai/local-state.json'), before);
    assert.equal(statSync(join(root, 'CLAUDE.md')).mtimeMs, mtime);
  }));

test('copied CLI initializes without dependencies and resolves the repository from its own script', () =>
  fixture(({ root, write, read }) => {
    mkdirSync(join(root, 'scripts'));
    cpSync(installer, join(root, 'scripts/ai-setup.mjs'));
    write('package.json', {
      name: 'shipping-api',
      packageManager: 'pnpm@10.0.0',
      scripts: { build: 'nest build', test: 'vitest run' },
    });
    const cli = join(root, 'scripts/ai-setup.mjs');
    const output = execFileSync(process.execPath, [cli, '--init'], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    assert.match(output, /setup complete/);
    assert.equal(JSON.parse(read('.ai/project.json')).commands.build, 'pnpm run build');
    assert.equal(existsSync(join(root, 'node_modules')), false);
    assert.match(
      execFileSync(process.execPath, [cli, '--check'], {
        cwd: tmpdir(),
        encoding: 'utf8',
      }),
      /check passed/,
    );
  }));

test('a malformed project skill fails before installing or changing the manifest', () =>
  fixture(({ root, write, read, configure }) => {
    setupAi(root, { init: true });
    const state = read('.ai/local-state.json');
    const installed = read('.agents/skills/review/SKILL.md');
    write(
      '.ai/team-skills/review/SKILL.md',
      '---\nname: incorrect-name\ndescription: Review project changes.\n---\n',
    );
    configure({ skillSources: ['.ai/team-skills'] });
    assert.throws(() => setupAi(root), /matching name and a description/);
    assert.equal(read('.ai/local-state.json'), state);
    assert.equal(read('.agents/skills/review/SKILL.md'), installed);
  }));

test('project skills replace entire core skills and carry nested reference files to every client', () =>
  fixture(({ root, write, read, configure }) => {
    setupAi(root, { init: true });
    write(
      '.ai/team-skills/review/SKILL.md',
      '---\nname: review\ndescription: Review this project with its specific policy.\n---\nRead references/policy.md.\n',
    );
    write('.ai/team-skills/review/references/policy.md', 'Project access policy');
    write('docs/project.md', '# Project rules');
    configure({ skillSources: ['.ai/team-skills'], rules: ['docs/project.md'] });
    assert.throws(() => setupAi(root, { check: true }), /outdated/);
    setupAi(root);
    for (const dir of ['.agents', '.claude', '.cursor']) {
      assert.match(read(`${dir}/skills/review/SKILL.md`), /specific policy/);
      assert.equal(read(`${dir}/skills/review/references/policy.md`), 'Project access policy');
    }
    assert.match(read('.ai/generated/project-context.md'), /docs\/project.md/);
    configure({ skillSources: [] });
    setupAi(root);
    assert.equal(existsSync(join(root, '.agents/skills/review/references/policy.md')), false);
    assert.match(read('.agents/skills/review/SKILL.md'), /read-only/);
  }));

test('preflight refuses a modified generated skill without changing other files', () =>
  fixture(({ root, write, read }) => {
    setupAi(root, { init: true });
    const state = read('.ai/local-state.json');
    const original = read('.claude/skills/review/SKILL.md');
    write('.agents/skills/review/SKILL.md', 'Member notes that must survive');
    write('.ai/core/skills/review/SKILL.md', `${original}\nChanged source\n`);
    assert.throws(() => setupAi(root), /refusing to overwrite\/delete/);
    assert.equal(read('.agents/skills/review/SKILL.md'), 'Member notes that must survive');
    assert.equal(read('.claude/skills/review/SKILL.md'), original);
    assert.equal(read('.ai/local-state.json'), state);
  }));

test('preserves an authored root policy and refuses an unrelated existing client adapter', () =>
  fixture(({ root, write, read }) => {
    write('AGENTS.md', '# Team policy\nRead .ai/core/index.md.\n');
    write('CLAUDE.md', 'Personal project instructions');
    assert.throws(() => setupAi(root, { init: true }), /CLAUDE.md/);
    assert.equal(existsSync(join(root, '.ai/project.json')), false);
    assert.equal(existsSync(join(root, '.gitignore')), false);
    rmSync(join(root, 'CLAUDE.md'));
    setupAi(root, { init: true });
    assert.equal(read('AGENTS.md'), '# Team policy\nRead .ai/core/index.md.\n');
  }));

test('does not replace an existing AGENTS.md that has not been connected to the core', () =>
  fixture(({ root, write, read }) => {
    write('AGENTS.md', 'Other policy');
    assert.throws(() => setupAi(root, { init: true }), /Add a required/);
    assert.equal(read('AGENTS.md'), 'Other policy');
    assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
  }));

test('rejects invalid configuration and out-of-root source paths before writing', () =>
  fixture(({ root, write, read, configure }) => {
    setupAi(root, { init: true });
    const state = read('.ai/local-state.json');
    for (const rules of [['../outside.md'], ['/tmp/outside.md']]) {
      configure({ rules });
      assert.throws(() => setupAi(root), /path|Path/);
    }
    write('.ai/project.json', { version: 2 });
    assert.throws(() => setupAi(root), /Invalid project configuration/);
    assert.equal(read('.ai/local-state.json'), state);
  }));

test('rejects symlink destinations and source resources without following them', () =>
  fixture(({ root, write, read, configure }) => {
    setupAi(root, { init: true });
    mkdirSync(join(root, 'member-files'));
    write('member-files/keep.md', 'keep');
    rmSync(join(root, '.claude/skills'), { recursive: true });
    symlinkSync(join(root, 'member-files'), join(root, '.claude/skills'), 'dir');
    assert.throws(() => setupAi(root), /Symlink/);
    assert.equal(read('member-files/keep.md'), 'keep');
    rmSync(join(root, '.claude/skills'));
    write(
      '.ai/team-skills/review/SKILL.md',
      '---\nname: review\ndescription: Team review policy.\n---\n',
    );
    symlinkSync(join(root, 'member-files/keep.md'), join(root, '.ai/team-skills/review/policy.md'));
    configure({ skillSources: ['.ai/team-skills'] });
    assert.throws(() => setupAi(root), /Symlink/);
  }));

test('refuses edited stale resources and keeps unowned member skills', () =>
  fixture(({ root, write, read, configure }) => {
    setupAi(root, { init: true });
    write(
      '.ai/team-skills/team-only/SKILL.md',
      '---\nname: team-only\ndescription: Team-specific workflow skill.\n---\n',
    );
    configure({ skillSources: ['.ai/team-skills'] });
    setupAi(root);
    write('.agents/skills/team-only/SKILL.md', 'Edited local skill');
    write('.agents/skills/member-only/SKILL.md', 'Unmanaged member skill');
    configure({ skillSources: [] });
    assert.throws(() => setupAi(root), /refusing to overwrite\/delete/);
    assert.equal(read('.agents/skills/team-only/SKILL.md'), 'Edited local skill');
    assert.equal(read('.agents/skills/member-only/SKILL.md'), 'Unmanaged member skill');
  }));

test('generated paths are ignored by Git while canonical policy and automation remain visible', () =>
  fixture(({ root, write, read }) => {
    write('.gitignore', '# Existing team ignores\nnode_modules/\n');
    setupAi(root, { init: true });
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const paths = [
      '.agents/skills/review/SKILL.md',
      '.claude/skills/review/SKILL.md',
      '.cursor/skills/review/SKILL.md',
      '.ai/local-state.json',
      '.ai/generated/project-context.md',
      'CLAUDE.md',
      '.github/copilot-instructions.md',
      '.cursor/rules/team-nestjs.mdc',
    ];
    const ignored = execFileSync('git', ['check-ignore', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
    })
      .trim()
      .split('\n');
    assert.deepEqual(ignored, paths);
    const visible = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.match(visible, /\.ai\/core\/index.md/);
    assert.match(visible, /\.ai\/project.json/);
    assert.match(visible, /AGENTS.md/);
    assert.match(read('.gitignore'), /^# Existing team ignores\nnode_modules\//);
  }));

test('rejects a tampered local state that tries to delete unrelated source', () =>
  fixture(({ root, write, read }) => {
    setupAi(root, { init: true });
    write('important.md', 'Keep this source');
    write('.ai/local-state.json', { version: 1, files: { 'important.md': 'a'.repeat(64) } });
    assert.throws(() => setupAi(root), /Invalid managed file/);
    assert.equal(read('important.md'), 'Keep this source');
  }));

test('repository ignores local artifacts without hiding team configuration, templates or generated references', () =>
  fixture(({ root, write }) => {
    write('.gitignore', readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'));
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const ignored = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.test',
      '.claude/settings.local.json',
      '.claude/sessions/local.json',
      '.claude/skills/backend-change/SKILL.md',
      '.agents/skills/review/SKILL.md',
      '.cursor/skills/review/SKILL.md',
      '.cursor/rules/team-nestjs.mdc',
      '.ai/generated/project-context.md',
      '.ai/local-state.json',
      '.github/copilot-instructions.md',
      'CLAUDE.md',
      'dist/src/main.js',
      'src/generated/prisma/client.ts',
      'src/generated/list-query/models.ts',
      '.vercel/output/config.json',
      'node_modules/library/index.js',
      'docs/.vitepress/dist/index.html',
      'docs/.vitepress/cache/state.json',
      'docs/.vitepress/.temp/page.js',
      '.playwright-mcp/screenshot.png',
      'coverage/index.html',
      'build.tsbuildinfo',
      'debug.log',
    ];
    const versioned = [
      '.env.example',
      '.env.production.example',
      '.env.test.example',
      'AGENTS.md',
      'Dockerfile',
      '.dockerignore',
      '.nvmrc',
      'vercel.json',
      '.ai/core/index.md',
      '.ai/project.json',
      '.codex/skills/backend-change/SKILL.md',
      '.codex/config.toml',
      '.claude/settings.json',
      '.claude/rules/business.md',
      '.claude/commands/review.md',
      '.claude/hooks/check.sh',
      '.cursor/rules/business.mdc',
      '.github/workflows/quality.yml',
      '.vscode/settings.json',
      'docs/generated/openapi.json',
      'docs/generated/database.md',
    ];
    for (const path of [...ignored, ...versioned]) write(path, 'sanitized fixture');
    const result = execFileSync(
      'git',
      ['check-ignore', '--no-index', '--', ...ignored, ...versioned],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n');
    assert.deepEqual(result, ignored);
    const visible = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
    }).split('\n');
    for (const path of versioned)
      assert.ok(visible.includes(path), `${path} must remain eligible for commit`);
  }));
