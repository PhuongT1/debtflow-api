import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDatabaseEnvironment } from './database-environment.ts';
import { migrationCommand } from './database-migrate.mjs';

for (const environment of ['staging', 'production']) {
  test(`${environment}: selects its file and overrides inherited database URLs`, () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'migration-command-')));
    try {
      const prisma = join(cwd, 'node_modules/prisma');
      mkdirSync(prisma, { recursive: true });
      writeFileSync(
        join(prisma, 'package.json'),
        JSON.stringify({ name: 'prisma', bin: { prisma: 'cli/custom.js' } }),
      );
      writeFileSync(
        join(cwd, `.env.${environment}`),
        'DATABASE_URL=postgresql://fixture@localhost/runtime\nDIRECT_URL=postgresql://fixture@localhost/direct\n',
      );
      for (const action of ['apply', 'status']) {
        const command = migrationCommand(environment, action, {
          cwd,
          env: { DATABASE_URL: 'wrong-runtime', DIRECT_URL: 'wrong-direct', PATH: 'fixture-path' },
        });
        assert.deepEqual(command.args, [
          join(cwd, 'node_modules/prisma/cli/custom.js'),
          'migrate',
          action === 'apply' ? 'deploy' : 'status',
        ]);
        assert.equal(command.options.env.DATABASE_URL, 'postgresql://fixture@localhost/runtime');
        assert.equal(command.options.env.DIRECT_URL, 'postgresql://fixture@localhost/direct');
        assert.equal(command.options.env.PATH, 'fixture-path');
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}
test('rejects missing URLs instead of falling back to development', () => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'migration-command-')));
  try {
    writeFileSync(
      join(cwd, '.env.staging'),
      'DATABASE_URL=postgresql://fixture@localhost/runtime\n',
    );
    assert.throws(() => migrationCommand('staging', 'apply', { cwd }), /must define DIRECT_URL/);
    writeFileSync(join(cwd, '.env.staging'), 'DIRECT_URL=postgresql://fixture@localhost/direct\n');
    assert.throws(() => migrationCommand('staging', 'apply', { cwd }), /must define DATABASE_URL/);
    assert.throws(
      () => migrationCommand('production', 'apply', { cwd }),
      /Cannot read .env.production/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test('rejects unknown environments and destructive actions before reading files', () => {
  assert.throws(() => migrationCommand('development', 'deploy'), /Usage/);
  assert.throws(() => migrationCommand('production', 'reset'), /Usage/);
});

for (const environment of ['development', 'staging', 'production']) {
  test(`${environment}: environment loader ignores inherited URLs and rejects invalid file URLs`, () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'environment-fixture-')));
    const filename = environment === 'development' ? '.env' : `.env.${environment}`;
    try {
      writeFileSync(
        join(cwd, filename),
        'DATABASE_URL=postgresql://fixture@localhost/runtime\nDIRECT_URL=postgresql://fixture@localhost/direct\n',
      );
      const database = readDatabaseEnvironment(environment, {
        cwd,
        env: { DATABASE_URL: 'wrong', DIRECT_URL: 'wrong' },
      });
      assert.equal(database.filename, filename);
      assert.equal(database.url, 'postgresql://fixture@localhost/runtime');
      writeFileSync(
        join(cwd, filename),
        'DATABASE_URL=https://invalid\nDIRECT_URL=postgresql://fixture@localhost/direct\n',
      );
      assert.throws(
        () => readDatabaseEnvironment(environment, { cwd }),
        /valid PostgreSQL DATABASE_URL/,
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}
