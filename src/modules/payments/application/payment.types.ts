import type { DecimalAmount } from '@common/utils/decimal-amount.types.js';
import type { PaginationInput } from '@common/utils/pagination.util.js';
import type { PayableDebt, PaymentAllocation } from '../domain/payable-debt.types.js';

export type PaymentListInput = PaginationInput & { debtId?: string; partyId?: string };

export type CreatePaymentInput = {
  amount: string;
  paidAt: string;
  method?: 'CASH' | 'BANK_TRANSFER' | 'OTHER';
  referenceNo?: string;
  note?: string;
};

export type CreateAllocatedPaymentInput = CreatePaymentInput &
  Pick<PayableDebt, 'partyId' | 'type'>;

export type VoucherInput = Pick<PayableDebt, 'organizationId' | 'partyId' | 'type'> & {
  input: CreatePaymentInput & { createdById?: string };
  allocations: PaymentAllocation[];
};

type StoredAllocation = { debtId: string; amount: DecimalAmount };
export type PaymentAuditSource = { allocations: StoredAllocation[] };
export type PaymentWithDetails = Pick<PayableDebt, 'partyId' | 'type'> & {
  id: string;
  amount: DecimalAmount;
  allocations: Array<StoredAllocation & { debt: PayableDebt }>;
};
