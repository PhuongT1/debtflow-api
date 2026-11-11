import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { ListQueryResult } from '@common/query/index.js';
import type { QueryPaymentsDto } from '../dto/query-payments.dto.js';
import type {
  DebtPaymentUpdate,
  PayableDebt,
  PaymentWithDetails,
  VoucherInput,
} from '../payment.types.js';

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
  deletePayment(organizationId: string, id: string): Promise<void>;
  updateDebt(organizationId: string, id: string, state: DebtPaymentUpdate): Promise<void>;
};

export abstract class PaymentsRepository {
  abstract list(
    query: QueryPaymentsDto,
    organizationId: string,
    listQuery?: ListQueryResult,
  ): Promise<PaginatedResult<PaymentWithDetails>>;
  abstract inTransaction<T>(work: (store: PaymentWriteStore) => Promise<T>): Promise<T>;
}
