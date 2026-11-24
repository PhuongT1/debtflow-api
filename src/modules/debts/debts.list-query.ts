import { CollectionStatus, DebtStatus, DebtType, SalesChannel } from '@generated/prisma/client.js';
import { defineListQuery } from '@common/query/index.js';

/** Fields clients may filter and sort on for `GET /debts`, `/reports/aging` and `/exports/debts`. */
export const DEBT_LIST_QUERY = defineListQuery({
  model: 'Debt',
  fields: {
    code: { type: 'string' },
    title: { type: 'string' },
    type: { type: 'enum', values: Object.values(DebtType) },
    status: { type: 'enum', values: Object.values(DebtStatus) },
    collectionStatus: { type: 'enum', values: Object.values(CollectionStatus) },
    salesChannel: { type: 'enum', values: Object.values(SalesChannel), nullable: true },
    partyId: { type: 'string', sortable: false },
    partyName: { type: 'string', path: 'party.name' },
    assignedToId: { type: 'string', nullable: true, sortable: false },
    invoiceNo: { type: 'string', nullable: true },
    orderNo: { type: 'string', nullable: true },
    contractNo: { type: 'string', nullable: true },
    poNo: { type: 'string', nullable: true },
    originalAmount: { type: 'decimal' },
    paidAmount: { type: 'decimal' },
    issueDate: { type: 'date' },
    dueDate: { type: 'date' },
    nextFollowUpAt: { type: 'date', nullable: true },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
  },
});
