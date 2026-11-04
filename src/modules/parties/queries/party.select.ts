import type { Prisma } from '@generated/prisma/client.js';

export function partyListInclude(organizationId: string) {
  return {
    assignedTo: { select: { id: true, name: true, email: true } },
    _count: { select: { debts: { where: { organizationId } } } },
  } satisfies Prisma.PartyInclude;
}
