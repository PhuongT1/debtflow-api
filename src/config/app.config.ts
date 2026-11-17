import { registerAs, type ConfigType } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { validateEnv } from './env.validation.js';

// Resolve configuration after environment loading; never capture secrets at module import time.
export function readDatabaseConfig(env = process.env) {
  const url = env.DATABASE_URL;
  if (!url?.trim())
    throw new Error('DATABASE_URL is required to initialize database configuration.');
  return { url, directUrl: env.DIRECT_URL?.trim() || url };
}

export function getEnvFilePaths(env = process.env) {
  return [`.env.${env.NODE_ENV ?? 'development'}`, '.env'];
}

export function createAppConfig(env = process.env) {
  const validated = validateEnv(env);
  return {
    server: {
      environment: env.NODE_ENV ?? 'development',
      port: validated.PORT,
      corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:3000')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
    database: readDatabaseConfig(env),
    auth: {
      jwtSecret: env.JWT_SECRET!,
      accessTokenExpiresIn: (env.JWT_EXPIRES_IN ?? '15m') as JwtSignOptions['expiresIn'],
      refreshTokenExpiresIn: (env.JWT_REFRESH_EXPIRES_IN ?? '7d') as JwtSignOptions['expiresIn'],
    },
  };
}

export const appConfig = registerAs('app', () => createAppConfig());
export type AppConfig = ConfigType<typeof appConfig>;
