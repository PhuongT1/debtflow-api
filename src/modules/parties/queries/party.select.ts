import type { Prisma } from '@generated/prisma/client.js';

export function partyListInclude(organizationId: string) {
  return {
    assignedTo: { select: { id: true, name: true, email: true } },
    _count: { select: { debts: { where: { organizationId } } } },
  } satisfies Prisma.PartyInclude;
}

export const PARTY_DETAIL_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true } },
  debts: { orderBy: { dueDate: 'asc' } },
} satisfies Prisma.PartyInclude;
