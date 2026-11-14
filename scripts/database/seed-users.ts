import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { OrganizationRole, PrismaClient } from '../../src/generated/prisma/client.ts';
import { provisionUser, ProvisioningError } from './create-user.js';
import { DatabaseEnvironmentError, readDatabaseEnvironment } from './database-environment.js';

type UserInput = Parameters<typeof provisionUser>[1];

// Stable test identities allow repeatable logins without duplicating accounts.
export const TEST_USERS = [
  { name: 'QA Owner', email: 'owner@qa.debtflow.local', role: OrganizationRole.OWNER },
  { name: 'QA Admin', email: 'admin@qa.debtflow.local', role: OrganizationRole.ADMIN },
  { name: 'QA Admin 1', email: 'admin1@qa.debtflow.local', role: OrganizationRole.ADMIN },
  { name: 'QA Admin 2', email: 'admin2@qa.debtflow.local', role: OrganizationRole.ADMIN },
  {
    name: 'QA Accountant',
    email: 'accountant@qa.debtflow.local',
    role: OrganizationRole.ACCOUNTANT,
  },
  { name: 'QA Viewer', email: 'viewer@qa.debtflow.local', role: OrganizationRole.VIEWER },
] as const satisfies readonly Omit<UserInput, 'password' | 'organizationId'>[];

export function testUserEnvironment(value: string): 'development' | 'staging' {
  if (value !== 'development' && value !== 'staging')
    throw new ProvisioningError('Test accounts are allowed only in development or staging.');
  return value;
}

export async function seedTestUsers(
  environment: string,
  createUser: (input: UserInput) => ReturnType<typeof provisionUser>,
) {
  testUserEnvironment(environment);
  const results: Awaited<ReturnType<typeof provisionUser>>[] = [];
  for (const account of TEST_USERS) {
    results.push(await createUser({ ...account, password: 'Abcd@1234' }));
  }
  return results;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { help: { type: 'boolean' } },
  });
  const usage = 'Usage: npm run db:user:seed:<dev|staging>';
  if (values.help) return console.log(usage);
  if (positionals.length !== 1) throw new ProvisioningError(usage);
  const environment = testUserEnvironment(positionals[0]);
  const database = readDatabaseEnvironment(environment);
  const target = new URL(database.url);
  console.log(
    `Environment: ${environment}; database: ${target.pathname.slice(1)}; host: ${target.host}`,
  );
  const prisma = new PrismaClient({ adapter: new PrismaPg(database.url) });
  try {
    console.table(await seedTestUsers(environment, (input) => provisionUser(prisma, input)));
    console.log(
      'Test accounts ready. CREATED means new; UNCHANGED preserves existing credentials and access.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof ProvisioningError || error instanceof DatabaseEnvironmentError
        ? error.message
        : 'Test account provisioning failed. Check the target database and migration status; earlier completed accounts remain. No credentials are printed.',
    );
    process.exitCode = 1;
  });
}
