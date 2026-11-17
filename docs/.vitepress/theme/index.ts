import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import DiagramViewer from './DiagramViewer.vue';
import SectionIndex from './SectionIndex.vue';
import SourceCodeViewer from './SourceCodeViewer.vue';
import DocsPageHeader from './DocsPageHeader.vue';
import './docs-theme.css';
import './diagram-viewer.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SectionIndex', SectionIndex);
    app.component('SourceCodeViewer', SourceCodeViewer);
  },
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'doc-before': () => h(DocsPageHeader),
      'layout-bottom': () => h(DiagramViewer),
    }),
} satisfies Theme;
