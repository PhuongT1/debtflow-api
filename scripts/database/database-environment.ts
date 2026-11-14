import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export type DatabaseEnvironment = 'development' | 'staging' | 'production';
export class DatabaseEnvironmentError extends Error {}

// Read one explicit environment file; inherited database URLs must never choose the target.
export function readDatabaseEnvironment(
  environment: string,
  { cwd = process.cwd(), env = process.env } = {},
) {
  if (!['development', 'staging', 'production'].includes(environment)) {
    throw new DatabaseEnvironmentError('Environment must be development, staging or production.');
  }
  const filename = environment === 'development' ? '.env' : `.env.${environment}`;
  let values: ReturnType<typeof parseEnv>;
  try {
    values = parseEnv(readFileSync(resolve(cwd, filename), 'utf8'));
  } catch {
    throw new DatabaseEnvironmentError(
      `Cannot read ${filename}; prepare the environment file first.`,
    );
  }
  const readUrl = (key: 'DATABASE_URL' | 'DIRECT_URL') => {
    const value = values[key];
    if (!value?.trim()) throw new DatabaseEnvironmentError(`${filename} must define ${key}.`);
    try {
      const parsed = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
        throw new DatabaseEnvironmentError();
    } catch {
      throw new DatabaseEnvironmentError(`${filename} must define a valid PostgreSQL ${key}.`);
    }
    return value;
  };
  const url = readUrl('DATABASE_URL');
  const directUrl = readUrl('DIRECT_URL');
  return {
    filename,
    url,
    env: { ...env, DATABASE_URL: url, DIRECT_URL: directUrl },
  };
}
