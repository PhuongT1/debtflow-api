import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Build a Prisma command without executing it; callers can supply another project root.
 * Database URLs come exclusively from the selected release environment file.
 * @param {string} environment
 * @param {string} action
 * @param {{cwd?: string, env?: NodeJS.ProcessEnv}} [options]
 */
export function migrationCommand(
  environment,
  action,
  { cwd = process.cwd(), env = process.env } = {},
) {
  if (!['staging', 'production'].includes(environment) || !['deploy', 'status'].includes(action)) {
    throw new Error(
      'Usage: node scripts/database/database-migrate.mjs <staging|production> <deploy|status>',
    );
  }
  const filename = `.env.${environment}`;
  const values = parseEnv(readFileSync(resolve(cwd, filename), 'utf8'));
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    if (!values[key]?.trim()) throw new Error(`${filename} must define ${key}.`);
  }
  const require = createRequire(resolve(cwd, 'package.json'));
  const packagePath = require.resolve('prisma/package.json');
  const { bin } = JSON.parse(readFileSync(packagePath, 'utf8'));
  const cli = typeof bin === 'string' ? bin : bin?.prisma;
  if (typeof cli !== 'string') throw new Error('Installed Prisma package has no CLI entry.');
  return {
    args: [resolve(dirname(packagePath), cli), 'migrate', action],
    options: {
      cwd,
      env: { ...env, DATABASE_URL: values.DATABASE_URL, DIRECT_URL: values.DIRECT_URL },
      stdio: 'inherit',
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const command = migrationCommand(process.argv[2], process.argv[3]);
    const result = spawnSync(process.execPath, command.args, command.options);
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
