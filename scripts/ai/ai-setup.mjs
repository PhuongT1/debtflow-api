import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const stateFile = '.ai/local-state.json';
const contextFile = '.ai/generated/project-context.md';
const skillTargets = ['.codex/skills', '.agents/skills', '.claude/skills', '.cursor/skills'];
const adapters = [
  'AGENTS.md',
  'CLAUDE.md',
  '.cursor/rules/team-nestjs.mdc',
  '.github/copilot-instructions.md',
];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const portable = (value) => value.replaceAll('\\', '/');
const ignored = [
  '/.ai/generated/',
  '/.ai/local-state.json',
  '/.codex/skills/',
  '/.agents/skills/',
  '/.claude/skills/',
  '/.cursor/skills/',
  '/CLAUDE.md',
  '/.cursor/rules/team-nestjs.mdc',
  '/.github/copilot-instructions.md',
];
const ignoreStart = '# BEGIN team AI generated files';
const ignoreEnd = '# END team AI generated files';

/** Offline, deterministic installation. Configuration is data; commands are never executed. */
export function setupAi(root = defaultRoot, { check = false, init = false } = {}) {
  root = resolve(root);
  const safe = (name) => {
    if (typeof name !== 'string' || !name || name.includes('\\') || isAbsolute(name))
      throw Error(`Expected a repository-relative path: ${name}`);
    const target = resolve(root, name);
    if (portable(relative(root, target)) !== name || name === '..' || name.startsWith('../'))
      throw Error(`Path must stay inside the repository: ${name}`);
    let part = root;
    for (const segment of name.split('/')) {
      part = resolve(part, segment);
      try {
        if (lstatSync(part).isSymbolicLink())
          throw Error(`Symlink paths are not supported; preserve/migrate manually: ${name}`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return target;
  };
  const read = (name) => readFileSync(safe(name), 'utf8');
  const configFile = '.ai/project.json';
  const configExists = existsSync(safe(configFile));
  let config;
  if (configExists) config = JSON.parse(read(configFile));
  else {
    if (!init) throw Error('Missing .ai/project.json. Use --init for a new NestJS project.');
    const pkg = JSON.parse(read('package.json'));
    const manager = pkg.packageManager?.split('@')[0] ?? 'npm';
    if (!['npm', 'pnpm', 'yarn', 'bun'].includes(manager))
      throw Error('Set a supported packageManager in package.json before initializing.');
    const prefix = manager === 'yarn' ? 'yarn' : `${manager} run`;
    config = {
      version: 1,
      name: pkg.name,
      rules: [],
      skillSources: [],
      commands: Object.fromEntries(
        ['lint', 'test', 'build', 'check']
          .filter((key) => pkg.scripts?.[key])
          .map((key) => [key, `${prefix} ${key}`]),
      ),
    };
  }
  if (
    config.version !== 1 ||
    typeof config.name !== 'string' ||
    !config.name.trim() ||
    !Array.isArray(config.rules) ||
    !Array.isArray(config.skillSources) ||
    !config.commands ||
    typeof config.commands !== 'object' ||
    Array.isArray(config.commands) ||
    Object.values(config.commands).some((value) => typeof value !== 'string')
  )
    throw Error(
      'Invalid project configuration: expected version 1, name, rules, skillSources, commands.',
    );
  for (const source of config.skillSources)
    if (
      typeof source !== 'string' ||
      !source.startsWith('.ai/') ||
      source === '.ai/generated' ||
      source.startsWith('.ai/generated/')
    )
      throw Error('Skill sources must be maintained under .ai/, outside generated outputs.');
  for (const rule of config.rules) read(rule);
  const coreRoot = '.ai/core';
  for (const topic of [
    'index',
    'architecture/structure',
    'architecture/maintainability',
    'backend/api-validation',
    'backend/security',
    'backend/persistence',
    'workflow/verification',
    'workflow/testing',
  ])
    read(`${coreRoot}/${topic}.md`);

  const walk = (directory) => {
    const files = new Map();
    for (const entry of readdirSync(safe(directory), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const name = `${directory}/${entry.name}`;
      safe(name);
      if (entry.isDirectory()) {
        for (const [path, bytes] of walk(name)) files.set(`${entry.name}/${path}`, bytes);
      } else if (entry.isFile()) files.set(entry.name, readFileSync(safe(name)));
      else throw Error(`Unsupported skill resource: ${name}`);
    }
    return files;
  };
  const skills = new Map();
  // Later project sources replace a complete core skill, never mix stale references into it.
  for (const source of [`${coreRoot}/skills`, ...config.skillSources]) {
    for (const entry of readdirSync(safe(source), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (!entry.isDirectory()) {
        if (entry.isSymbolicLink()) safe(`${source}/${entry.name}`);
        continue; // Author-maintained catalog files are not skills.
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) || entry.name.length > 64)
        throw Error(`Invalid skill directory: ${entry.name}`);
      const files = walk(`${source}/${entry.name}`);
      const content = files.get('SKILL.md')?.toString('utf8');
      const frontmatter = content?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
      if (
        !frontmatter ||
        !new RegExp(`^name: ${entry.name}$`, 'm').test(frontmatter) ||
        !/^description: \S.+$/m.test(frontmatter)
      )
        throw Error(`Skill needs matching name and a description: ${source}/${entry.name}`);
      skills.set(entry.name, files);
    }
  }

  const output = new Map();
  const routing = `Read and follow AGENTS.md, .ai/core/index.md and ${contextFile}.\n`;
  output.set(
    'CLAUDE.md',
    `# Team NestJS instructions\n\n@AGENTS.md\n@.ai/core/index.md\n@${contextFile}\n`,
  );
  output.set(
    '.cursor/rules/team-nestjs.mdc',
    `---\ndescription: Team NestJS core and project policy\nalwaysApply: true\n---\n\n${routing}`,
  );
  output.set('.github/copilot-instructions.md', `# Team NestJS instructions\n\n${routing}`);
  output.set(
    contextFile,
    `# ${config.name} — project context\n\nGenerated by ai:setup; edit .ai/project.json and its source rules.\n\nRead the applicable project rules:\n${config.rules.map((path) => `- ${path}`).join('\n') || '- No project rules configured yet; inspect the application and configure them before changing business behavior.'}\n\nConfigured verification commands (reference only; setup never executes them):\n\n\`\`\`json\n${JSON.stringify(config.commands, null, 2)}\n\`\`\`\n`,
  );
  for (const [name, files] of skills)
    for (const target of skillTargets)
      for (const [path, bytes] of files) output.set(`${target}/${name}/${path}`, bytes);

  const state = existsSync(safe(stateFile))
    ? JSON.parse(read(stateFile))
    : { version: 1, files: {} };
  if (
    state.version !== 1 ||
    !state.files ||
    typeof state.files !== 'object' ||
    Array.isArray(state.files)
  )
    throw Error('Invalid local AI state. Preserve local files before regenerating.');
  const managedPath = (path) =>
    adapters.includes(path) ||
    path === contextFile ||
    skillTargets.some((dir) => path.startsWith(`${dir}/`));
  for (const [path, digest] of Object.entries(state.files)) {
    if (!managedPath(path) || !/^[a-f0-9]{64}$/.test(digest))
      throw Error(`Invalid managed file: ${path}`);
    safe(path);
  }
  // Existing authored AGENTS.md stays canonical and tracked, never replaced by generated policy.
  if (!existsSync(safe('AGENTS.md')) || state.files['AGENTS.md'])
    output.set(
      'AGENTS.md',
      `# ${config.name} — agent guide\n\nRead .ai/core/index.md and ${contextFile} before implementation.\nProject source configuration: .ai/project.json. Explicit user scope applies.\n`,
    );
  else if (!read('AGENTS.md').includes('.ai/core/index.md'))
    throw Error(
      'Existing AGENTS.md is preserved. Add a required .ai/core/index.md reference, then rerun.',
    );

  // Preflight every output and removal before writing anything, including .gitignore/config.
  const conflicts = [];
  const changes = [];
  for (const [path, content] of output) {
    const target = safe(path);
    const bytes = Buffer.from(content);
    const current = existsSync(target) ? readFileSync(target) : undefined;
    if (current?.equals(bytes)) continue;
    if (current && hash(current) !== state.files[path]) conflicts.push(path);
    else changes.push(path);
  }
  const stale = Object.keys(state.files).filter((path) => !output.has(path));
  for (const path of stale)
    if (existsSync(safe(path)) && hash(readFileSync(safe(path))) !== state.files[path])
      conflicts.push(path);
  if (conflicts.length)
    throw Error(
      `Preserve local edits before setup; refusing to overwrite/delete:\n${conflicts.join('\n')}`,
    );

  const oldIgnore = existsSync(safe('.gitignore')) ? read('.gitignore') : '';
  const block = `${ignoreStart}\n${ignored.join('\n')}\n${ignoreEnd}`;
  const start = oldIgnore.indexOf(ignoreStart);
  const end = oldIgnore.indexOf(ignoreEnd);
  if (start < 0 !== end < 0 || (start >= 0 && end < start))
    throw Error('Malformed AI .gitignore block.');
  const nextIgnore =
    start < 0
      ? `${oldIgnore}${oldIgnore && !oldIgnore.endsWith('\n') ? '\n' : ''}\n${block}\n`
      : `${oldIgnore.slice(0, start)}${block}${oldIgnore.slice(end + ignoreEnd.length)}`;
  const nextState = json({
    version: 1,
    files: Object.fromEntries([...output].map(([path, bytes]) => [path, hash(bytes)])),
  });
  const stateMatches = existsSync(safe(stateFile)) && read(stateFile) === nextState;
  if (check) {
    if (
      changes.length ||
      stale.length ||
      oldIgnore !== nextIgnore ||
      !stateMatches ||
      !configExists
    )
      throw Error(
        `AI installation is missing/outdated. Run npm run ai:setup (or node scripts/ai/ai-setup.mjs).\n${[...changes, ...stale].join('\n')}`,
      );
    return { skills: skills.size, changed: 0 };
  }
  const write = (path, value) => {
    const target = safe(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, value);
  };
  if (!configExists) write(configFile, json(config));
  if (nextIgnore !== oldIgnore) write('.gitignore', nextIgnore);
  for (const path of changes) write(path, output.get(path));
  for (const path of stale) if (existsSync(safe(path))) rmSync(safe(path));
  if (!stateMatches) write(stateFile, nextState);
  return { skills: skills.size, changed: changes.length + stale.length };
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--check', '--init'].includes(arg)))
      throw Error('Usage: node scripts/ai/ai-setup.mjs [--init] [--check]');
    const result = setupAi(defaultRoot, {
      check: args.includes('--check'),
      init: args.includes('--init'),
    });
    console.log(
      `AI ${args.includes('--check') ? 'check passed' : 'setup complete'}: ${result.skills} skills per client; ${result.changed} changed files.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
