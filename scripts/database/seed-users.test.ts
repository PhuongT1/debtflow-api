import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seedTestUsers, TEST_USERS } from './seed-users.js';
import { OrganizationRole } from '../../src/generated/prisma/client.ts';

const unchanged = async (input: Parameters<Parameters<typeof seedTestUsers>[1]>[0]) => ({
  result: 'UNCHANGED' as const,
  userId: input.email,
  email: input.email,
  organizationId: 'test-workspace',
  role: input.role as OrganizationRole,
});

test('production and unknown environments reject before provisioning', async () => {
  for (const environment of ['production', 'prod', '', 'test']) {
    let calls = 0;
    await assert.rejects(
      seedTestUsers(environment, async (input) => {
        calls++;
        return unchanged(input);
      }),
      /only in development or staging/,
    );
    assert.equal(calls, 0);
  }
});

test('dev and staging use the same six stable accounts and valid test password', async () => {
  for (const environment of ['development', 'staging']) {
    const inputs: Parameters<Parameters<typeof seedTestUsers>[1]>[0][] = [];
    const results = await seedTestUsers(environment, async (input) => {
      inputs.push(input);
      return unchanged(input);
    });
    assert.equal(inputs.length, 6);
    assert.equal(new Set(inputs.map(({ email }) => email)).size, 6);
    assert.deepEqual(
      new Set(inputs.map(({ role }) => role)),
      new Set(Object.values(OrganizationRole)),
    );
    assert.ok(
      inputs.every(
        ({ password, organizationId }) => password === 'Abcd@1234' && organizationId === undefined,
      ),
    );
    assert.ok(results.every(({ result }) => result === 'UNCHANGED'));
    assert.deepEqual(
      inputs.map(({ email }) => email),
      TEST_USERS.map(({ email }) => email),
    );
  }
});

test('a conflict stops the batch and preserves the original error', async () => {
  let calls = 0;
  const conflict = new Error('Existing access differs');
  await assert.rejects(
    seedTestUsers('staging', async (input) => {
      if (++calls === 2) throw conflict;
      return unchanged(input);
    }),
    (error) => error === conflict,
  );
  assert.equal(calls, 2);
});
