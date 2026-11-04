import { PartyType } from '@generated/prisma/client.js';
import { defineListQuery } from '@common/query/index.js';

/**
 * Fields clients may filter and sort on for `GET /parties`.
 * `outstandingDocuments`, `receivable` and `payable` use an owned
 * PostgreSQL aggregate/page query (sort only), so generic Prisma orderBy skips them.
 */
export const PARTY_LIST_QUERY = defineListQuery({
  model: 'Party',
  fields: {
    name: { type: 'string' },
    code: { type: 'string', nullable: true },
    type: { type: 'enum', values: Object.values(PartyType) },
    phone: { type: 'string', nullable: true },
    email: { type: 'string', nullable: true },
    taxCode: { type: 'string', nullable: true },
    provinceCode: { type: 'string', nullable: true, sortable: false },
    provinceName: { type: 'string', nullable: true },
    creditLimit: { type: 'decimal', nullable: true },
    isActive: { type: 'boolean', filterable: false },
    assignedToId: { type: 'string', nullable: true, sortable: false },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
    outstandingDocuments: {
      type: 'number',
      filterable: false,
      description: 'Number of debts of the party.',
      computed: true,
    },
    receivable: {
      type: 'decimal',
      filterable: false,
      computed: true,
      description: 'Remaining receivable balance.',
    },
    payable: {
      type: 'decimal',
      filterable: false,
      computed: true,
      description: 'Remaining payable balance.',
    },
  },
});
