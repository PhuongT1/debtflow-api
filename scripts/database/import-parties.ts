import { readDatabaseConfig } from '../../src/config/app.config.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { partySearchText } from '../../src/common/utils/search-normalization.util.js';
import { loadEnvFile } from 'node:process';
import { PartyType, Prisma, PrismaClient } from '../../src/generated/prisma/client.ts';

loadEnvFile('.env');

const database = readDatabaseConfig();
const organizationId = process.argv[2];
const partyCount = Number(process.argv[3] ?? process.env.IMPORT_PARTY_COUNT ?? 100);

const prisma = new PrismaClient({
  adapter: new PrismaPg(database.url),
});

async function main() {
  if (!organizationId) throw new Error('Usage: npm run db:import:parties -- <organizationId> [count]');
  if (!Number.isSafeInteger(partyCount) || partyCount < 1 || partyCount > 1000) {
    throw new Error('Party count must be an integer between 1 and 1000.');
  }
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true },
  });
  if (organization?.status !== 'ACTIVE') throw new Error('Target organization must be active.');
  const parties = createParties(partyCount);
  let created = 0;
  let updated = 0;

  for (const party of parties) {
    const where = { organizationId_code: { organizationId, code: party.code } };
    const data = {
      ...party,
      searchText: partySearchText(party.name, party.code, party.phone, party.taxCode),
      isActive: true,
    } satisfies Omit<Prisma.PartyUncheckedCreateInput, 'organizationId'>;
    const existing = await prisma.party.findUnique({
      where,
      select: { id: true },
    });

    await prisma.party.upsert({
      where,
      update: data,
      create: { ...data, organizationId },
    });

    if (existing) {
      updated += 1;
      continue;
    }

    created += 1;
  }

  console.log(
    `Import parties done. Created: ${created}. Updated: ${updated}. Total: ${parties.length}.`,
  );
}

function createParties(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const padded = String(number).padStart(3, '0');
    const type =
      number % 5 === 0
        ? PartyType.BOTH
        : number % 2 === 0
          ? PartyType.SUPPLIER
          : PartyType.CUSTOMER;
    const prefix = type === PartyType.SUPPLIER ? 'SUP' : type === PartyType.BOTH ? 'BTH' : 'CUS';

    return {
      type,
      code: `DEMO-${prefix}-${padded}`,
      name: `${typeLabel(type)} Demo ${padded}`,
      phone: `090${String(1000000 + number).slice(-7)}`,
      email: `party.demo.${padded}@debtflow.local`,
      taxCode: `TAX${String(7000000000 + number)}`,
      address: `${number} Nguyen Trai Street, District ${(number % 12) + 1}, Ho Chi Minh City`,
      note: 'Imported directly into PostgreSQL by demo script.',
      creditLimit: new Prisma.Decimal(5000000 + number * 250000),
    };
  });
}

function typeLabel(type: PartyType) {
  if (type === PartyType.SUPPLIER) {
    return 'Supplier';
  }

  if (type === PartyType.BOTH) {
    return 'Customer Supplier';
  }

  return 'Customer';
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
