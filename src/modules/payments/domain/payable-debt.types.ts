import type { DecimalAmount } from '@common/utils/decimal-amount.types.js';
import type { DebtFilters } from '@modules/debts/public/debt-filters.types.js';

export type PayableDebt = {
  id: string;
  organizationId: string;
  partyId: string;
  type: NonNullable<DebtFilters['type']>;
  status: NonNullable<DebtFilters['status']>;
  originalAmount: DecimalAmount;
  paidAmount: DecimalAmount;
};

export type PaymentAllocation = { amount: DecimalAmount; debt: PayableDebt };
export type DebtPaymentUpdate = Pick<PayableDebt, 'paidAmount' | 'status'>;
