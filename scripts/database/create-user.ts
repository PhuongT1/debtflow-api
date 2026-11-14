import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { validateSync } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  OrganizationKind,
  OrganizationMembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  SystemRole,
  UserStatus,
  Prisma,
  PrismaClient,
} from '../../src/generated/prisma/client.ts';
import { CreateUserDto } from '../../src/modules/users/dto/create-user.dto.js';
import { DatabaseEnvironmentError, readDatabaseEnvironment } from './database-environment.js';

type UserInput = Pick<CreateUserDto, 'name' | 'email' | 'password'> & {
  organizationId?: string;
  role: string;
};
export class ProvisioningError extends Error {}
const PROVISION_RESULT = { CREATED: 'CREATED', UNCHANGED: 'UNCHANGED' } as const;
const ROLE_CHOICES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.ACCOUNTANT,
  OrganizationRole.VIEWER,
] as const;

export function parseUserRole(value: string): OrganizationRole {
  const selection = value.trim().toUpperCase() || '4';
  const role = ROLE_CHOICES.find(
    (role, index) => selection === String(index + 1) || selection === role,
  );
  if (!role) throw new ProvisioningError('Choose a role from 1–4 or enter its name.');
  return role;
}

const DEFAULT_ORGANIZATION = {
  slug: 'default-workspace',
  name: 'Default workspace',
  kind: OrganizationKind.BUSINESS,
  status: OrganizationStatus.ACTIVE,
} satisfies Pick<Prisma.OrganizationCreateInput, 'slug' | 'name' | 'kind' | 'status'>;

// Reuse API credential validation; provisioning never changes an existing account or membership.
export async function provisionUser(
  prisma: Pick<PrismaClient, '$transaction'>,
  input: UserInput,
  hashPassword = (password: string) => bcrypt.hash(password, 12),
) {
  const requestedOrganizationId = input.organizationId?.trim();
  const invalidOrganization = input.organizationId !== undefined && !requestedOrganizationId;
  const dto = Object.assign(new CreateUserDto(), {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: input.role,
  });
  const invalid = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (invalidOrganization || invalid.length) {
    throw new ProvisioningError(
      `Invalid user input: ${[...(invalidOrganization ? ['organizationId'] : []), ...invalid.map(({ property }) => property)].join(', ')}.`,
    );
  }
  const passwordHash = await hashPassword(dto.password);
  return prisma.$transaction(
    async (tx) => {
      let organization = await tx.organization.findUnique({
        where: requestedOrganizationId
          ? { id: requestedOrganizationId }
          : { slug: DEFAULT_ORGANIZATION.slug },
        select: { id: true, status: true },
      });
      if (!organization && !requestedOrganizationId) {
        organization = await tx.organization.create({
          data: DEFAULT_ORGANIZATION,
          select: { id: true, status: true },
        });
        await tx.auditLog.create({
          data: {
            organizationId: organization.id,
            actorId: null,
            entityType: 'Organization',
            entityId: organization.id,
            action: 'PROVISION_DEFAULT_ORGANIZATION',
            after: { source: 'database-user-cli', slug: DEFAULT_ORGANIZATION.slug },
          },
        });
      }
      if (organization?.status !== OrganizationStatus.ACTIVE)
        throw new ProvisioningError('Target organization must exist and be ACTIVE.');
      const organizationId = organization.id;
      const existing = await tx.user.findUnique({
        where: { email: dto.email },
        select: {
          id: true,
          email: true,
          status: true,
          systemRole: true,
          memberships: { where: { organizationId }, select: { role: true, status: true } },
        },
      });
      if (existing) {
        const membership = existing.memberships[0];
        if (
          existing.status !== UserStatus.ACTIVE ||
          existing.systemRole !== SystemRole.USER ||
          membership?.status !== OrganizationMembershipStatus.ACTIVE ||
          membership.role !== dto.role
        ) {
          throw new ProvisioningError(
            'Email already exists with different access/state. No account, password or role was changed; use the member management API.',
          );
        }
        return {
          result: PROVISION_RESULT.UNCHANGED,
          userId: existing.id,
          email: existing.email,
          organizationId,
          role: membership.role,
        };
      }
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          status: UserStatus.ACTIVE,
          systemRole: SystemRole.USER,
          memberships: {
            create: {
              organizationId,
              role: dto.role,
              status: OrganizationMembershipStatus.ACTIVE,
              joinedAt: new Date(),
            },
          },
        },
        select: { id: true, email: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId: null,
          entityType: 'User',
          entityId: user.id,
          action: 'PROVISION_USER',
          after: {
            source: 'database-user-cli',
            email: user.email,
            role: dto.role,
            status: UserStatus.ACTIVE,
          },
        },
      });
      return {
        result: PROVISION_RESULT.CREATED,
        userId: user.id,
        email: user.email,
        organizationId,
        role: dto.role,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function readPassword(prompt: string) {
  if (!process.stdin.isTTY)
    throw new ProvisioningError(
      'Run this command in an interactive terminal; passwords are entered without echo.',
    );
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(prompt);
  try {
    return await reader.question('');
  } finally {
    reader.close();
    process.stdout.write('\n');
  }
}

async function main() {
  const usage =
    'Usage: npm run db:user:create:<dev|staging|production> [-- --organization-id <id> --email <email> --name <name> --role <1|2|3|4|OWNER|ADMIN|ACCOUNTANT|VIEWER>]';
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean' },
      'organization-id': { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (positionals.length !== 1) throw new ProvisioningError(usage);
  const database = readDatabaseEnvironment(positionals[0]);
  const target = new URL(database.url);
  console.log(
    `Environment: ${positionals[0]}; database: ${target.pathname.slice(1)}; host: ${target.host}`,
  );
  if (!process.stdin.isTTY)
    throw new ProvisioningError('Run this command in an interactive terminal.');
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  let role: string, email: string, name: string;
  try {
    if (values.role === undefined)
      console.log(ROLE_CHOICES.map((role, index) => `${index + 1}. ${role}`).join('\n'));
    role = parseUserRole(values.role ?? (await reader.question('Role [4]: ')));
    const defaultEmail = `qa.${role.toLowerCase()}@debtflow.local`;
    email = values.email ?? ((await reader.question(`Email [${defaultEmail}]: `)) || defaultEmail);
    name = values.name ?? ((await reader.question(`Name [QA ${role}]: `)) || `QA ${role}`);
  } finally {
    reader.close();
  }
  console.log(
    `Organization: ${values['organization-id'] ?? `default slug ${DEFAULT_ORGANIZATION.slug} (create if missing)`}; role: ${role}`,
  );
  const password = await readPassword('New user password (hidden): ');
  if (password !== (await readPassword('Confirm password (hidden): ')))
    throw new ProvisioningError('Passwords do not match.');
  const prisma = new PrismaClient({ adapter: new PrismaPg(database.url) });
  try {
    const result = await provisionUser(prisma, {
      organizationId: values['organization-id'],
      email,
      name,
      role,
      password,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof ProvisioningError || error instanceof DatabaseEnvironmentError
        ? error.message
        : 'User provisioning failed. Check arguments, environment file, database availability and migration status. No credentials are printed.',
    );
    process.exitCode = 1;
  });
}
