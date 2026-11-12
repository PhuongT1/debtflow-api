import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
        'DATABASE_URL=fixture-runtime\nDIRECT_URL=fixture-direct\n',
      );
      for (const action of ['deploy', 'status']) {
        const command = migrationCommand(environment, action, {
          cwd,
          env: { DATABASE_URL: 'wrong-runtime', DIRECT_URL: 'wrong-direct', PATH: 'fixture-path' },
        });
        assert.deepEqual(command.args, [
          join(cwd, 'node_modules/prisma/cli/custom.js'),
          'migrate',
          action,
        ]);
        assert.equal(command.options.env.DATABASE_URL, 'fixture-runtime');
        assert.equal(command.options.env.DIRECT_URL, 'fixture-direct');
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
    writeFileSync(join(cwd, '.env.staging'), 'DATABASE_URL=fixture-runtime\n');
    assert.throws(() => migrationCommand('staging', 'deploy', { cwd }), /must define DIRECT_URL/);
    writeFileSync(join(cwd, '.env.staging'), 'DIRECT_URL=fixture-direct\n');
    assert.throws(() => migrationCommand('staging', 'deploy', { cwd }), /must define DATABASE_URL/);
    assert.throws(() => migrationCommand('production', 'deploy', { cwd }), /ENOENT/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test('rejects unknown environments and destructive actions before reading files', () => {
  assert.throws(() => migrationCommand('development', 'deploy'), /Usage/);
  assert.throws(() => migrationCommand('production', 'reset'), /Usage/);
});
