import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@auth': resolve(import.meta.dirname, 'src/auth'),
      '@common': resolve(import.meta.dirname, 'src/common'),
      '@config': resolve(import.meta.dirname, 'src/config'),
      '@database': resolve(import.meta.dirname, 'src/database'),
      '@generated': resolve(import.meta.dirname, 'src/generated'),
      '@modules': resolve(import.meta.dirname, 'src/modules'),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
