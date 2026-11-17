import { loadEnvFile } from 'node:process';
import { readDatabaseConfig } from './src/config/app.config.js';
import { defineConfig } from 'prisma/config';

try {
  loadEnvFile('.env');
} catch {
  // Local development may rely on shell-provided env vars instead of a .env file.
}

const database = readDatabaseConfig();

export default defineConfig({
  schema: 'prisma/',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  engine: 'classic',
  datasource: {
    url: database.url,
    directUrl: database.directUrl,
  },
});
