import { readCorePages } from '../../.vitepress/core-pages.mts';

export default {
  paths: () =>
    readCorePages().map(({ topic, content }) => ({
      params: { topic },
      content,
    })),
};
