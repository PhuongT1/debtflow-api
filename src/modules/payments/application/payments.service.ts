import type {
  CreateAllocatedPaymentInput,
  CreatePaymentInput,
  PaymentAuditSource,
  PaymentListInput,
  PaymentWithDetails,
  VoucherInput,
} from './payment.types.js';
import type { DebtPaymentUpdate, PayableDebt } from '../domain/payable-debt.types.js';
import { ApplicationError } from '@common/errors/application-error.js';
import { AuditAction } from '@common/events/audit.types.js';
import type { PublishAudit } from '@common/events/audit-publisher.port.js';
import { scalarSnapshot } from '@common/events/audit-snapshot.js';
import type { DebtMoneyMath, DecimalAmount } from '@common/utils/decimal-amount.types.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PaymentsRepository, PaymentWriteStore } from './repositories/payments.repository.js';
import {
  allocatePayment,
  assertPayableDebt,
  paymentAmount,
} from '../domain/payment-allocation.rules.js';

type ResolveDebtPaymentState = (
  debt: { originalAmount: DecimalAmount },
  paidAmount: DecimalAmount,
) => DebtPaymentUpdate;

export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly publishAudit: PublishAudit,
    private readonly money: Pick<DebtMoneyMath, 'parseMoney' | 'sum'>,
    private readonly resolveDebtPaymentState: ResolveDebtPaymentState,
  ) {}

  async create(
    debtId: string,
    input: CreatePaymentInput,
    organizationId: string,
    createdById?: string,
  ) {
    requireOrganizationId(organizationId);
    const payment = await this.repository.inTransaction(async (store) => {
      const debt = await store.findDebt(organizationId, debtId);
      const amount = paymentAmount(input.amount, this.money.parseMoney);
      assertPayableDebt(debt, amount);

      return this.createVoucher(store, {
        organizationId,
        allocations: [{ amount, debt }],
        input: { ...input, createdById },
        partyId: debt.partyId,
        type: debt.type,
      });
    });

    this.auditCreated(payment, organizationId, createdById);

    return payment;
  }

  async createAutoAllocated(
    input: CreateAllocatedPaymentInput,
    organizationId: string,
    createdById?: string,
  ) {
    requireOrganizationId(organizationId);
    const payment = await this.repository.inTransaction(async (store) => {
      const amount = paymentAmount(input.amount, this.money.parseMoney);
      const debts = await store.findDebts(organizationId, input.partyId, input.type);
      const allocations = allocatePayment(debts, amount);

      return this.createVoucher(store, {
        organizationId,
        allocations,
        input: { ...input, createdById },
        partyId: input.partyId,
        type: input.type,
      });
    });

    this.auditCreated(payment, organizationId, createdById);

    return payment;
  }

  async list(query: PaymentListInput, organizationId: string, listQuery?: ListQueryOptions) {
    requireOrganizationId(organizationId);
    return this.repository.list(query, organizationId, listQuery);
  }

  async remove(id: string, organizationId: string, actorId?: string) {
    requireOrganizationId(organizationId);
    const result = await this.repository.inTransaction(async (store) => {
      const payment = await store.findPayment(organizationId, id);
      if (payment.allocations.some(({ debt }) => debt.organizationId !== organizationId)) {
        throw new ApplicationError('forbidden', 'errors.FORBIDDEN');
      }
      if (
        !payment.allocations.length ||
        !payment.amount.equals(
          this.money.sum(payment.allocations.map(({ amount }) => amount)).toString(),
        ) ||
        payment.allocations.some(
          ({ debt }) => debt.partyId !== payment.partyId || debt.type !== payment.type,
        )
      )
        throw new ApplicationError('conflict', 'debts.INCONSISTENT_PAYMENT_BALANCE');
      await this.assertReconciledDebts(
        store,
        organizationId,
        payment.allocations.map(({ debt }) => debt),
      );
      const updates = payment.allocations.map(({ amount, debt }) => ({
        id: debt.id,
        state: this.resolveDebtPaymentState(debt, debt.paidAmount.minus(amount.toString())),
      }));
      await store.deletePayment(organizationId, id);

      await Promise.all(
        updates.map(({ id, state }) => store.updateDebt(organizationId, id, state)),
      );

      return { payment, restoredDebtCount: payment.allocations.length };
    });

    this.publishAudit({
      organizationId,
      actorId,
      entityType: 'Payment',
      entityId: id,
      action: AuditAction.PaymentReversed,
      before: this.paymentSnapshot(result.payment),
    });

    return { id, restoredDebtCount: result.restoredDebtCount };
  }

  private auditCreated(
    payment: Pick<PaymentWithDetails, 'id'> & PaymentAuditSource,
    organizationId: string,
    actorId?: string,
  ) {
    this.publishAudit({
      organizationId,
      actorId,
      entityType: 'Payment',
      entityId: payment.id,
      action: AuditAction.PaymentCreated,
      after: this.paymentSnapshot(payment),
    });
  }

  private paymentSnapshot(payment: PaymentAuditSource) {
    return {
      ...scalarSnapshot(payment),
      allocations: payment.allocations.map(({ debtId, amount }) => ({
        debtId,
        amount: amount.toString(),
      })),
    };
  }

  private async createVoucher(store: PaymentWriteStore, payload: VoucherInput) {
    requireOrganizationId(payload.organizationId);
    if (payload.allocations.some(({ debt }) => debt.organizationId !== payload.organizationId)) {
      throw new ApplicationError('forbidden', 'errors.FORBIDDEN');
    }
    if (
      payload.allocations.some(
        ({ debt }) => debt.partyId !== payload.partyId || debt.type !== payload.type,
      )
    )
      throw new ApplicationError('conflict', 'debts.INCONSISTENT_PAYMENT_BALANCE');
    await this.assertReconciledDebts(
      store,
      payload.organizationId,
      payload.allocations.map(({ debt }) => debt),
    );
    const payment = await store.createPayment(payload);

    await Promise.all(
      payload.allocations.map(({ amount, debt }) =>
        store.updateDebt(
          payload.organizationId,
          debt.id,
          this.resolveDebtPaymentState(debt, debt.paidAmount.plus(amount.toString())),
        ),
      ),
    );

    return payment;
  }

  private async assertReconciledDebts(
    store: PaymentWriteStore,
    organizationId: string,
    debts: PayableDebt[],
  ) {
    if (!debts.length) return;
    const totals = await store.allocationTotals(
      organizationId,
      debts.map(({ id }) => id),
    );
    if (debts.some(({ id, paidAmount }) => !paidAmount.equals(totals.get(id)?.toString() ?? 0)))
      throw new ApplicationError('conflict', 'debts.INCONSISTENT_PAYMENT_BALANCE');
  }
}
