import type { Debt, PaymentAllocation, Prisma } from '@generated/prisma';
import type { CreatePaymentDto } from '../dto/create-payment.dto';
import type { PAYMENT_DETAILS_INCLUDE } from '../queries/payment.select';

export type PaymentWithDetails = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_DETAILS_INCLUDE;
}>;
export type PaymentAuditSource = {
  allocations: Array<Pick<PaymentAllocation, 'debtId' | 'amount'>>;
};
export type PayableDebt = Pick<
  Debt,
  'id' | 'organizationId' | 'partyId' | 'type' | 'originalAmount' | 'paidAmount' | 'status'
>;
export type VoucherInput = {
  organizationId: string;
  partyId: Debt['partyId'];
  type: Debt['type'];
  input: CreatePaymentDto & { createdById?: string };
  allocations: Array<{ amount: Prisma.Decimal; debt: PayableDebt }>;
};
