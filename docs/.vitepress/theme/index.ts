import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import DiagramViewer from './DiagramViewer.vue';
import './diagram-viewer.css';

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'layout-bottom': () => h(DiagramViewer) }),
} satisfies Theme;
