import type { MarkdownOptions } from 'vitepress';

// Reuse VitePress clipboard exclusions; syntax scopes keep comment markers inside strings intact.
export function excludeCommentsFromCopy(): NonNullable<
  MarkdownOptions['codeTransformers']
>[number] {
  return {
    name: 'debtflow:copy-without-comments',
    preprocess(_code, options) {
      options.includeExplanation = 'scopeName';
    },
    span(node, _line, _column, _lineNode, token) {
      const isComment = token.explanation?.some(({ scopes }) =>
        scopes.some(({ scopeName }) => /^comment(?:\.|$)/.test(scopeName)),
      );
      if (isComment && !token.content.startsWith('#!')) {
        const comment = { ...node, properties: { ...node.properties } };
        this.addClassToHast(comment, 'vp-copy-ignore');
        // A separator preserves valid code when a block comment separates two tokens.
        node.children = [comment, { type: 'text', value: ' ' }];
      }
    },
  };
}
