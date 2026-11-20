import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from 'node:util';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareDatabaseEnvironment } from './prepare-environment.mjs';

const url = 'postgresql://fixture:p%40ssword@db.example.test/staging';
const direct = 'postgresql://fixture:password@direct.example.test/staging';

test('uses readable Vercel values without requiring GitHub database secrets', () => {
  assert.deepEqual(prepareDatabaseEnvironment({ DATABASE_URL: url, DIRECT_URL: direct }), {
    DATABASE_URL: url,
    DIRECT_URL: direct,
  });
});
test('GitHub credentials replace empty or redacted Vercel values for the runner', () => {
  for (const value of ['', '[SENSITIVE]', '[REDACTED]']) {
    assert.deepEqual(
      prepareDatabaseEnvironment(
        { DATABASE_URL: value, DIRECT_URL: value },
        {
          DATABASE_URL: url,
          DIRECT_URL: direct,
        },
      ),
      { DATABASE_URL: url, DIRECT_URL: direct },
    );
  }
});
test('fails closed for missing or redacted database credentials', () => {
  for (const value of [undefined, '', '  ', '[SENSITIVE]', '[REDACTED]'])
    assert.throws(() => prepareDatabaseEnvironment({ DATABASE_URL: value }), /GitHub Environment/);
});
test('allows an unconfigured direct URL but rejects a configured inaccessible direct URL', () => {
  assert.deepEqual(prepareDatabaseEnvironment({ DATABASE_URL: url }), { DATABASE_URL: url });
  assert.throws(
    () => prepareDatabaseEnvironment({ DATABASE_URL: url, DIRECT_URL: '' }),
    /DIRECT_URL/,
  );
  assert.throws(
    () => prepareDatabaseEnvironment({ DATABASE_URL: url, DIRECT_URL: '[SENSITIVE]' }),
    /DIRECT_URL/,
  );
});
test('rejects invalid URLs and env-file injection without echoing credentials', () => {
  for (const value of [
    'https://secret.example.test',
    'private-invalid-value',
    `${url}\nJWT_SECRET=injected`,
  ]) {
    assert.throws(
      () => prepareDatabaseEnvironment({ DATABASE_URL: value }),
      (error) => {
        assert.ok(!error.message.includes(value));
        return /PostgreSQL/.test(error.message);
      },
    );
  }
});
test('connection strings with encoded credentials survive Node env-file parsing', () => {
  const value = 'postgresql://fixture:p%22%5C%0A%23%24@db.example.test/staging?sslmode=require';
  const result = prepareDatabaseEnvironment({ DATABASE_URL: value });
  assert.equal(parseEnv(`DATABASE_URL="${result.DATABASE_URL}"`).DATABASE_URL, value);
});

test('runner writes a private file whose values override redacted pull output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'debtflow-release-test-'));
  try {
    const pulled = join(directory, 'pulled.env');
    const prepared = join(directory, 'database.env');
    writeFileSync(pulled, 'DATABASE_URL="[SENSITIVE]"\nDIRECT_URL=""\n');
    const result = spawnSync(process.execPath, ['scripts/deployment/prepare-environment.mjs'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        RELEASE_ENV_FILE: pulled,
        RELEASE_DB_ENV_FILE: prepared,
        RELEASE_DATABASE_URL: url,
        RELEASE_DIRECT_URL: direct,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`::add-mask::${url.replaceAll('%', '%25')}`));
    assert.equal(statSync(prepared).mode & 0o777, 0o600);
    assert.equal(parseEnv(readFileSync(prepared, 'utf8')).DIRECT_URL, direct);
    const loaded = spawnSync(
      process.execPath,
      [
        `--env-file=${pulled}`,
        `--env-file=${prepared}`,
        '-e',
        'process.exit(process.env.DATABASE_URL === process.env.EXPECTED_URL && process.env.DIRECT_URL === process.env.EXPECTED_DIRECT ? 0 : 1)',
      ],
      { env: { EXPECTED_URL: url, EXPECTED_DIRECT: direct } },
    );
    assert.equal(loaded.status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
