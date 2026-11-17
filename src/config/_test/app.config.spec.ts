import { describe, expect, it } from 'vitest';
import { createAppConfig, getEnvFilePaths, readDatabaseConfig } from '../app.config.js';

const required = {
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/not_connected',
  JWT_SECRET: 'fixture-secret-with-at-least-24-characters',
};

describe('application configuration', () => {
  it('resolves shared defaults and supports one database URL', () => {
    const config = createAppConfig(required);
    expect(config.server).toEqual({
      environment: 'development',
      port: 4000,
      corsOrigins: ['http://localhost:3000'],
    });
    expect(config.database).toEqual({
      url: required.DATABASE_URL,
      directUrl: required.DATABASE_URL,
    });
    expect(config.auth).toEqual({
      jwtSecret: required.JWT_SECRET,
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    });
  });

  it('honors explicit settings without coupling database CLI configuration to JWT secrets', () => {
    const config = createAppConfig({
      ...required,
      NODE_ENV: 'production',
      PORT: '4500',
      DIRECT_URL: 'postgresql://fixture:fixture@127.0.0.1:2/not_connected',
      CORS_ORIGIN: 'https://app.example.com, https://admin.example.com',
      JWT_EXPIRES_IN: '30m',
      JWT_REFRESH_EXPIRES_IN: '14d',
    });
    expect(config.server).toEqual({
      environment: 'production',
      port: 4500,
      corsOrigins: ['https://app.example.com', 'https://admin.example.com'],
    });
    expect(config.database.directUrl).not.toBe(config.database.url);
    expect(config.auth.accessTokenExpiresIn).toBe('30m');
    expect(config.auth.refreshTokenExpiresIn).toBe('14d');
    expect(readDatabaseConfig({ DATABASE_URL: required.DATABASE_URL })).toEqual({
      url: required.DATABASE_URL,
      directUrl: required.DATABASE_URL,
    });
  });

  it('rejects missing secrets, invalid database URLs and invalid ports at configuration creation', () => {
    expect(() => createAppConfig({ DATABASE_URL: required.DATABASE_URL })).toThrow('JWT_SECRET');
    expect(() => createAppConfig({ ...required, DATABASE_URL: 'https://example.com' })).toThrow(
      'DATABASE_URL',
    );
    expect(() => createAppConfig({ ...required, DIRECT_URL: 'invalid' })).toThrow('DIRECT_URL');
    expect(() => createAppConfig({ ...required, PORT: 'invalid' })).toThrow('PORT');
    expect(() => readDatabaseConfig({})).toThrow('DATABASE_URL');
  });

  it('selects environment files from the externally supplied runtime mode', () => {
    expect(getEnvFilePaths({})).toEqual(['.env.development', '.env']);
    expect(getEnvFilePaths({ NODE_ENV: 'production' })).toEqual(['.env.production', '.env']);
  });
});
