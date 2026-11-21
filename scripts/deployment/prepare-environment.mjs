import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const redacted = new Set(['[SENSITIVE]', '[REDACTED]']);

export function prepareDatabaseEnvironment(pulled, fallback = {}, { requireDirect = false } = {}) {
  const result = {};
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const supplied = fallback[key]?.trim();
    const downloaded = pulled[key]?.trim();
    const value = supplied || downloaded;
    if (!value || redacted.has(value)) {
      // DIRECT_URL is optional only when it was never configured. A redacted direct
      // connection must not silently become a pooler connection for migrations.
      if (key === 'DIRECT_URL' && !requireDirect && !Object.hasOwn(pulled, key) && !supplied)
        continue;
      throw new Error(
        `${key} is empty or unavailable from Vercel. Set ${key} in the matching GitHub Environment (staging or production) using the original database credential. Vercel Secret values cannot be recovered with pull.`,
      );
    }
    let url;
    try {
      url = new URL(value);
    } catch {
      // Never include the URL or the original parser error in release logs.
    }
    if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || /[\r\n"\\]/.test(value))
      throw new Error(
        `${key} must be a PostgreSQL connection URL without raw line breaks, quotes or backslashes. Encode special characters in credentials.`,
      );
    result[key] = value;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const pulled = parseEnv(readFileSync(process.env.RELEASE_ENV_FILE, 'utf8'));
    const database = prepareDatabaseEnvironment(
      pulled,
      {
        DATABASE_URL: process.env.RELEASE_DATABASE_URL,
        DIRECT_URL: process.env.RELEASE_DIRECT_URL,
      },
      { requireDirect: process.env.RELEASE_APPLY_MIGRATIONS === 'true' },
    );
    for (const value of Object.values(database))
      console.log(`::add-mask::${value.replaceAll('%', '%25')}`);
    writeFileSync(
      process.env.RELEASE_DB_ENV_FILE,
      Object.entries(database)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n') + '\n',
      { mode: 0o600, flag: 'wx' },
    );
    console.log('Database environment prepared for build and migration checks; values are masked.');
  } catch (error) {
    // File/parser errors can contain env content: report only our own validation errors.
    console.error(
      error.message?.startsWith('DATABASE_URL ') || error.message?.startsWith('DIRECT_URL ')
        ? error.message
        : 'Unable to prepare release environment files. Check the pull step and runner temporary directory.',
    );
    process.exitCode = 1;
  }
}
