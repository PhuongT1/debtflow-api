import type { Prisma } from '@generated/prisma';

export const PARTY_LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  _count: { select: { debts: true } },
} satisfies Prisma.PartyInclude;
