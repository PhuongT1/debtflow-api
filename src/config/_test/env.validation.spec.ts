import { describe, expect, it } from 'vitest';
import { validateEnv } from '../env.validation.js';

const required = {
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/not_connected',
  JWT_SECRET: 'fixture-secret-with-at-least-24-characters',
};

describe('server port configuration', () => {
  it('normalizes the environment port to a number', () => {
    expect(validateEnv({ ...required, PORT: '4789' }).PORT).toBe(4789);
  });

  it('defaults only when the port is missing and permits an OS-assigned test port', () => {
    expect(validateEnv(required).PORT).toBe(4000);
    expect(validateEnv({ ...required, PORT: '0' }).PORT).toBe(0);
  });

  it.each(['', ' ', '-1', '65536', '4000.5', 'not-a-port', '/tmp/api.sock', false])(
    'rejects an invalid port: %s',
    (PORT) => {
      expect(() => validateEnv({ ...required, PORT })).toThrow('PORT must be an integer');
    },
  );
});
