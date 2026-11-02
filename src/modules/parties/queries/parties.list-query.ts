import { PartyType } from '@generated/prisma';
import { defineListQuery } from '@common/query';

/**
 * Fields clients may filter and sort on for `GET /parties`.
 * `outstandingDocuments` is a database aggregate; `receivable` and `payable` are computed by
 * PartiesService (sort only), so they carry `computed: true`.
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
      sort: (direction) => ({ debts: { _count: direction } }),
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
