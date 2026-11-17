import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { parseUserRole, provisionUser } from './create-user.js';

test('role selection accepts numbered choices and case-insensitive names', () => {
  for (const [index, role] of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER'].entries()) {
    assert.equal(parseUserRole(` ${index + 1} `), role);
    assert.equal(parseUserRole(` ${role.toLowerCase()} `), role);
  }
  assert.equal(parseUserRole(''), 'VIEWER');
  assert.equal(parseUserRole('  '), 'VIEWER');
  for (const invalid of ['0', '5', '1.0', '01', 'ADMINISTRATOR'])
    assert.throws(() => parseUserRole(invalid), /Choose a role/);
});

const input = {
  organizationId: 'org-fixture',
  email: 'QA@Example.com',
  name: 'QA Accountant',
  role: 'ACCOUNTANT',
  password: 'Fixture123!',
};
function fixture({
  org = 'ACTIVE',
  existing = false,
  role = 'ACCOUNTANT',
  membership = 'ACTIVE',
  userStatus = 'ACTIVE',
  systemRole = 'USER',
} = {}) {
  const tx = {
    organization: {
      findUnique: mock.fn(async (_args: unknown) => {
        void _args;
        return org === 'MISSING' ? null : { id: 'org-fixture', status: org };
      }),
      create: mock.fn(async (args: unknown) => {
        void args;
        return { id: 'default-org-fixture', status: 'ACTIVE' };
      }),
    },
    user: {
      findUnique: mock.fn(async () =>
        existing
          ? {
              id: 'user-fixture',
              email: 'qa@example.com',
              status: userStatus,
              systemRole,
              memberships: membership === 'MISSING' ? [] : [{ role, status: membership }],
            }
          : null,
      ),
      create: mock.fn(async (args: unknown) => {
        void args;
        return { id: 'user-fixture', email: 'qa@example.com' };
      }),
    },
    auditLog: {
      create: mock.fn(async (args: unknown) => {
        void args;
        return { id: 'audit-fixture' };
      }),
    },
  };
  const transaction = mock.fn(async (run: (store: typeof tx) => Promise<unknown>) => run(tx));
  const prisma = { $transaction: transaction } as unknown as Parameters<typeof provisionUser>[0];
  const hash = mock.fn(async (password: string) => {
    void password;
    return 'fixture-hash';
  });
  return { tx, transaction, prisma, hash };
}

test('creates a scoped ordinary user and audit in one transaction without exposing credentials', async () => {
  const f = fixture();
  const result = await provisionUser(f.prisma, input, f.hash);
  assert.equal(result.result, 'CREATED');
  assert.equal(result.email, 'qa@example.com');
  assert.equal(f.transaction.mock.callCount(), 1);
  const write = f.tx.user.create.mock.calls[0].arguments[0] as { data: Record<string, unknown> };
  assert.equal(write.data.systemRole, 'USER');
  assert.equal(write.data.passwordHash, 'fixture-hash');
  assert.deepEqual(write.data.memberships, {
    create: {
      organizationId: 'org-fixture',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
      joinedAt: (write.data.memberships as { create: { joinedAt: Date } }).create.joinedAt,
    },
  });
  const audit = JSON.stringify(f.tx.auditLog.create.mock.calls[0].arguments);
  assert.ok(!audit.includes('fixture-hash'));
  assert.ok(!audit.includes(input.password));
  assert.ok(!JSON.stringify(result).includes('password'));
});
test('rerun with the same active membership does not overwrite the account or password', async () => {
  const f = fixture({ existing: true });
  const result = await provisionUser(f.prisma, input, f.hash);
  assert.equal(result.result, 'UNCHANGED');
  assert.equal(f.tx.user.create.mock.callCount(), 0);
  assert.equal(f.tx.auditLog.create.mock.callCount(), 0);
});
for (const options of [
  { org: 'MISSING' },
  { org: 'SUSPENDED' },
  { existing: true, role: 'VIEWER' },
  { existing: true, membership: 'MISSING' },
  { existing: true, membership: 'SUSPENDED' },
  { existing: true, userStatus: 'INACTIVE' },
  { existing: true, systemRole: 'PLATFORM_OWNER' },
]) {
  test(`rejects incompatible target/access without writes: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await assert.rejects(provisionUser(f.prisma, input, f.hash));
    assert.equal(f.tx.user.create.mock.callCount(), 0);
    assert.equal(f.tx.auditLog.create.mock.callCount(), 0);
  });
}
for (const override of [
  { organizationId: '' },
  { role: 'PLATFORM_OWNER' },
  { email: 'invalid' },
  { password: 'short' },
  { password: '1234' },
  { password: 'Đ'.repeat(40) + 'A1' },
]) {
  test(`rejects invalid input before database calls: ${Object.keys(override)[0]}`, async () => {
    const f = fixture();
    await assert.rejects(
      provisionUser(f.prisma, { ...input, ...override }, f.hash),
      /Invalid user input/,
    );
    assert.equal(f.transaction.mock.callCount(), 0);
    assert.equal(f.hash.mock.callCount(), 0);
  });
}

for (const role of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER']) {
  test(`supports explicit organization role ${role} without granting a platform role`, async () => {
    const f = fixture();
    const result = await provisionUser(f.prisma, { ...input, role }, f.hash);
    assert.equal(result.role, role);
    const write = f.tx.user.create.mock.calls[0].arguments[0] as { data: { systemRole: string } };
    assert.equal(write.data.systemRole, 'USER');
  });
}
test('does not report success when the audit write fails', async () => {
  const f = fixture();
  f.tx.auditLog.create.mock.mockImplementation(async () => {
    throw new Error('fixture audit failure');
  });
  await assert.rejects(provisionUser(f.prisma, input, f.hash), /fixture audit failure/);
});

test('without an organization ID, creates the named default workspace and scoped user atomically', async () => {
  const f = fixture({ org: 'MISSING' });
  const result = await provisionUser(f.prisma, { ...input, organizationId: undefined }, f.hash);
  assert.equal(result.organizationId, 'default-org-fixture');
  assert.deepEqual(f.tx.organization.findUnique.mock.calls[0].arguments[0], {
    where: { slug: 'default-workspace' },
    select: { id: true, status: true },
  });
  assert.equal(f.tx.organization.create.mock.callCount(), 1);
  assert.equal(f.transaction.mock.callCount(), 1);
  assert.equal(f.tx.auditLog.create.mock.callCount(), 2);
});
test('without an organization ID, reuses the fixed workspace rather than selecting an arbitrary tenant', async () => {
  const f = fixture();
  const result = await provisionUser(f.prisma, { ...input, organizationId: undefined }, f.hash);
  assert.equal(result.organizationId, 'org-fixture');
  assert.equal(f.tx.organization.create.mock.callCount(), 0);
  assert.deepEqual(f.tx.organization.findUnique.mock.calls[0].arguments[0], {
    where: { slug: 'default-workspace' },
    select: { id: true, status: true },
  });
});
test('an inactive default workspace is not automatically reactivated or replaced', async () => {
  const f = fixture({ org: 'SUSPENDED' });
  await assert.rejects(
    provisionUser(f.prisma, { ...input, organizationId: undefined }, f.hash),
    /ACTIVE/,
  );
  assert.equal(f.tx.organization.create.mock.callCount(), 0);
  assert.equal(f.tx.user.create.mock.callCount(), 0);
});
