import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { DebtPaymentUpdate, PayableDebt } from '../../domain/payable-debt.types.js';
import type { PaymentListInput, PaymentWithDetails, VoucherInput } from '../payment.types.js';

/** Operations bound to ONE transaction. No Prisma client or query arguments cross this port. */
export type PaymentWriteStore = {
  findDebt(organizationId: string, debtId: string): Promise<PayableDebt>;
  findDebts(
    organizationId: string,
    partyId: string,
    type: PayableDebt['type'],
  ): Promise<PayableDebt[]>;
  createPayment(payload: VoucherInput): Promise<PaymentWithDetails>;
  findPayment(organizationId: string, id: string): Promise<PaymentWithDetails>;
  allocationTotals(
    organizationId: string,
    debtIds: string[],
  ): Promise<ReadonlyMap<string, PayableDebt['paidAmount']>>;
  deletePayment(organizationId: string, id: string): Promise<void>;
  updateDebt(organizationId: string, id: string, state: DebtPaymentUpdate): Promise<void>;
};

export abstract class PaymentsRepository {
  abstract list(
    query: PaymentListInput,
    organizationId: string,
    listQuery?: ListQueryOptions,
  ): Promise<PaginatedResult<PaymentWithDetails>>;
  abstract inTransaction<T>(work: (store: PaymentWriteStore) => Promise<T>): Promise<T>;
}
