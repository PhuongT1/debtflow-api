import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnvFile } from 'node:process';
import { PartyType, Prisma, PrismaClient } from '../src/generated/prisma/client.ts';

type PartySeed = {
  type: PartyType;
  code: string;
  name: string;
  phone: string;
  email: string;
  taxCode: string;
  address: string;
  note: string;
  creditLimit: Prisma.Decimal;
};

loadEnvFile('.env');

const databaseUrl = process.env.DATABASE_URL;
const partyCount = Number(process.env.IMPORT_PARTY_COUNT ?? 100);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to import parties.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

async function main() {
  const parties = createParties(partyCount);
  let created = 0;
  let updated = 0;

  for (const party of parties) {
    const existing = await prisma.party.findUnique({
      where: { code: party.code },
      select: { id: true },
    });

    await prisma.party.upsert({
      where: { code: party.code },
      update: {
        type: party.type,
        name: party.name,
        phone: party.phone,
        email: party.email,
        taxCode: party.taxCode,
        address: party.address,
        note: party.note,
        creditLimit: party.creditLimit,
        isActive: true,
      },
      create: party,
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

function createParties(count: number): PartySeed[] {
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
