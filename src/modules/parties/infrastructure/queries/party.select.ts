/**
 * Owns Prisma projections used to read Party scalar fields, assignees and debt counts.
 * Record types, response fields and Swagger reuse these projections; DB calls live in the adapter.
 */
import type { Prisma } from '@generated/prisma/client.js';
import type { PartyDebt } from '../../application/party-read.types.js';

/** Explicit Prisma projection: this is the source of the record type and public scalar fields. */
export const PARTY_DEFAULT_SELECT = {
  id: true,
  organizationId: true,
  type: true,
  code: true,
  name: true,
  searchText: true,
  phone: true,
  email: true,
  taxCode: true,
  address: true,
  address2: true,
  note: true,
  provinceCode: true,
  provinceName: true,
  imageUrl: true,
  isActive: true,
  createdById: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
  creditLimit: true,
} satisfies Prisma.PartySelect;

const ASSIGNEE_SELECT = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

const PARTY_DETAIL_DEBT_SELECT = {
  id: true,
  organizationId: true,
  code: true,
  type: true,
  partyId: true,
  assignedToId: true,
  title: true,
  invoiceNo: true,
  orderNo: true,
  contractNo: true,
  poNo: true,
  description: true,
  originalAmount: true,
  paidAmount: true,
  currency: true,
  salesChannel: true,
  issueDate: true,
  dueDate: true,
  status: true,
  collectionStatus: true,
  nextFollowUpAt: true,
  followUpNote: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<keyof PartyDebt, true> & Prisma.DebtSelect;

/** Both list paths use this exact projection; tenant-scoped debt counts stay in the DB. */
export function partyListSelect(organizationId: string) {
  return {
    ...PARTY_DEFAULT_SELECT,
    assignedTo: { select: ASSIGNEE_SELECT },
    _count: { select: { debts: { where: { organizationId } } } },
  } satisfies Prisma.PartySelect;
}

/** Scope the child relation as well as its parent, even if an inconsistent link exists. */
export function partyDetailSelect(organizationId: string) {
  return {
    ...PARTY_DEFAULT_SELECT,
    assignedTo: { select: ASSIGNEE_SELECT },
    debts: {
      where: { organizationId },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      select: PARTY_DETAIL_DEBT_SELECT,
    },
  } satisfies Prisma.PartySelect;
}
