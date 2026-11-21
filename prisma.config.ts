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
  datasource: {
    // Prisma 7 uses datasource.url for CLI commands. Prefer the direct connection for migrations.
    url: database.directUrl,
  },
});
