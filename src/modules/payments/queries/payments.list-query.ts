import { DebtType, PaymentMethod } from '@generated/prisma/client.js';
import { defineListQuery } from '@common/query/index.js';

/** Fields clients may filter and sort on for `GET /payments`. */
export const PAYMENT_LIST_QUERY = defineListQuery({
  model: 'Payment',
  fields: {
    type: { type: 'enum', values: Object.values(DebtType) },
    method: { type: 'enum', values: Object.values(PaymentMethod) },
    amount: { type: 'decimal' },
    paidAt: { type: 'date' },
    referenceNo: { type: 'string', nullable: true },
    partyId: { type: 'string', sortable: false },
    partyName: { type: 'string', path: 'party.name' },
    createdAt: { type: 'date' },
  },
});
