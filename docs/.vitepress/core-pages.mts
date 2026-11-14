import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const coreRoot = resolve(import.meta.dirname, '../../.ai/core');

// Menu and routes share the same source inventory; no per-topic documentation copies.
export function readCorePages(root = coreRoot) {
  const topics = [
    'index.md',
    ...['architecture', 'backend', 'workflow'].flatMap((group) =>
      readdirSync(resolve(root, group))
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => `${group}/${name}`),
    ),
  ];
  return topics.map((file) => {
    const source = resolve(root, file);
    const markdown = readFileSync(source, 'utf8');
    const topic = file.slice(0, -3);
    const link = topic === 'index' ? '/team/core/' : `/team/core/${topic}`;
    const content = markdown.replace(
      /\]\((\.{1,2}\/[^)\s]+\.md)(#[^)]*)?\)/g,
      (_, target: string, hash = '') => {
        const destination = relative(root, resolve(dirname(source), target))
          .split(sep)
          .join('/');
        if (!topics.includes(destination))
          throw new Error(`Unknown core policy link: ${file} → ${target}`);
        return `](/team/core/${destination.replace(/index\.md$/, '').replace(/\.md$/, '')}${hash})`;
      },
    );
    return { topic, link, title: markdown.match(/^# (.+)$/m)?.[1] ?? topic, content };
  });
}

// VitePress 1.x route loaders do not watch external files; refresh routes/menu on source changes.
export function watchCorePages() {
  return {
    name: 'debtflow-core-policy-source',
    configureServer(server: import('vite').ViteDevServer) {
      server.watcher.add(coreRoot);
      const refresh = (_event: string, file: string) => {
        const path = relative(coreRoot, file);
        if (!path.startsWith('..') && path.endsWith('.md')) void server.restart();
      };
      server.watcher.on('all', refresh);
      server.httpServer?.once('close', () => server.watcher.off('all', refresh));
    },
  };
}
