type EnvConfig = Record<string, unknown>;

const requiredEnvKeys = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function validateEnv(config: EnvConfig) {
  const missingKeys = requiredEnvKeys.filter((key) => !String(config[key] ?? '').trim());

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  if (config.DATABASE_URL && !isPostgresUrl(String(config.DATABASE_URL))) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.');
  }

  if (config.DIRECT_URL && !isPostgresUrl(String(config.DIRECT_URL))) {
    throw new Error('DIRECT_URL must be a valid PostgreSQL connection string.');
  }

  const jwtSecret = String(config.JWT_SECRET);

  if (jwtSecret.length < 24) {
    throw new Error('JWT_SECRET must be at least 24 characters.');
  }

  const portInput = config.PORT ?? 4000;
  const port =
    typeof portInput === 'number'
      ? portInput
      : typeof portInput === 'string' && portInput.trim()
        ? Number(portInput)
        : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('PORT must be an integer between 0 and 65535.');

  return { ...config, PORT: port };
}

function isPostgresUrl(value: string) {
  return value.startsWith('postgresql://') || value.startsWith('postgres://');
}
