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

/** Existing API scalar contract. New DB columns are not exposed automatically. */
export const PARTY_RESPONSE_FIELDS = [
  'id',
  'organizationId',
  'type',
  'code',
  'name',
  'searchText',
  'phone',
  'email',
  'taxCode',
  'address',
  'address2',
  'note',
  'provinceCode',
  'provinceName',
  'imageUrl',
  'isActive',
  'createdById',
  'assignedToId',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof import('@generated/prisma/client.js').Party)[];
