import { PartyType, Prisma } from '@generated/prisma/client.js';
import { defineListQuery, type ListQueryField } from '@common/query/index.js';

/** Sort aliases for derived values; these are not columns of the Prisma Party model. */
export const PARTY_COMPUTED_SORT_FIELDS = {
  /** Source: partyListSelect -> _count.debts. Legacy name: counts ALL debts, including paid/cancelled. */
  outstandingDocuments: 'outstandingDocuments',
  /** Source: sum(originalAmount - paidAmount) for OPEN/PARTIAL RECEIVABLE debts. */
  receivable: 'receivable',
  /** Source: sum(originalAmount - paidAmount) for OPEN/PARTIAL PAYABLE debts. */
  payable: 'payable',
} as const;

export type PartyComputedSortField =
  (typeof PARTY_COMPUTED_SORT_FIELDS)[keyof typeof PARTY_COMPUTED_SORT_FIELDS];

/**
 * Fields clients may filter and sort on for `GET /parties`.
 * `outstandingDocuments`, `receivable` and `payable` use an owned
 * PostgreSQL aggregate/page query (sort only), so generic Prisma orderBy skips them.
 */
export const PARTY_LIST_QUERY = defineListQuery({
  model: 'Party',
  fields: {
    [Prisma.PartyScalarFieldEnum.name]: { type: 'string' },
    [Prisma.PartyScalarFieldEnum.code]: { type: 'string', nullable: true },
    [Prisma.PartyScalarFieldEnum.type]: { type: 'enum', values: Object.values(PartyType) },
    [Prisma.PartyScalarFieldEnum.phone]: { type: 'string', nullable: true },
    [Prisma.PartyScalarFieldEnum.email]: { type: 'string', nullable: true },
    [Prisma.PartyScalarFieldEnum.taxCode]: { type: 'string', nullable: true },
    [Prisma.PartyScalarFieldEnum.provinceCode]: { type: 'string', nullable: true, sortable: false },
    [Prisma.PartyScalarFieldEnum.provinceName]: { type: 'string', nullable: true },
    [Prisma.PartyScalarFieldEnum.creditLimit]: { type: 'decimal', nullable: true },
    [Prisma.PartyScalarFieldEnum.isActive]: { type: 'boolean', filterable: false },
    [Prisma.PartyScalarFieldEnum.assignedToId]: { type: 'string', nullable: true, sortable: false },
    [Prisma.PartyScalarFieldEnum.createdAt]: { type: 'date' },
    [Prisma.PartyScalarFieldEnum.updatedAt]: { type: 'date' },
    [PARTY_COMPUTED_SORT_FIELDS.outstandingDocuments]: {
      type: 'number',
      filterable: false,
      description: 'Total number of debts of the party, including paid and cancelled debts.',
      computed: true,
    },
    [PARTY_COMPUTED_SORT_FIELDS.receivable]: {
      type: 'decimal',
      filterable: false,
      computed: true,
      description: 'Remaining receivable balance.',
    },
    [PARTY_COMPUTED_SORT_FIELDS.payable]: {
      type: 'decimal',
      filterable: false,
      computed: true,
      description: 'Remaining payable balance.',
    },
  } satisfies Partial<Record<Prisma.PartyScalarFieldEnum, ListQueryField>> &
    Record<PartyComputedSortField, ListQueryField & { computed: true; filterable: false }>,
});
