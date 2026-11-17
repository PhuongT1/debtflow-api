import { dirname, relative, resolve, sep } from 'node:path';
import type { MarkdownRenderer } from 'vitepress';

// Resolve links against the real Markdown owner, then apply the same public URL rewrites.
export function sourceLinks(md: MarkdownRenderer, root: string, rewrites: Record<string, string>) {
  const renderLink = md.renderer.rules.link_open!;
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    const source = env.realPath ?? env.path;
    const match = href?.match(/^(\.{1,2}\/[^?#]+\.md)([?#].*)?$/);
    if (match && source) {
      const destination = relative(root, resolve(dirname(source), match[1]))
        .split(sep)
        .join('/');
      if (!destination.startsWith('../'))
        token.attrSet('href', `/${rewrites[destination] ?? destination}${match[2] ?? ''}`);
    }
    return renderLink(tokens, index, options, env, renderer);
  };
}
