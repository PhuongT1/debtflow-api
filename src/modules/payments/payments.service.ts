import type {
  PaymentWithDetails,
  PaymentAuditSource,
  VoucherInput,
} from './payment.types.js';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { forbidden } from '@common/errors/app-errors.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event.js';
import type { ListQueryResult } from '@common/query/index.js';
import { PaymentsRepository, type PaymentWriteStore } from './repositories/payments.repository.js';
import { CreateAllocatedPaymentDto } from './dto/create-allocated-payment.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { QueryPaymentsDto } from './dto/query-payments.dto.js';

import {
  allocatePayment,
  assertPayableDebt,
  paymentAmount,
} from './payment-allocation.rules.js';
import { debtPaymentState } from '@modules/debts/public/debts.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repository: PaymentsRepository,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    debtId: string,
    input: CreatePaymentDto,
    organizationId: string,
    createdById?: string,
  ) {
    requireOrganizationId(organizationId);
    const payment = await this.repository.inTransaction(async (store) => {
      const debt = await store.findDebt(organizationId, debtId);
      const amount = paymentAmount(input.amount);
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
    input: CreateAllocatedPaymentDto,
    organizationId: string,
    createdById?: string,
  ) {
    requireOrganizationId(organizationId);
    const payment = await this.repository.inTransaction(async (store) => {
      const amount = paymentAmount(input.amount);
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

  async list(query: QueryPaymentsDto, organizationId: string, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    return this.repository.list(query, organizationId, listQuery);
  }

  async remove(id: string, organizationId: string, actorId?: string) {
    requireOrganizationId(organizationId);
    const result = await this.repository.inTransaction(async (store) => {
      const payment = await store.findPayment(organizationId, id);
      if (payment.allocations.some(({ debt }) => debt.organizationId !== organizationId)) {
        throw forbidden('errors.FORBIDDEN');
      }
      await store.deletePayment(organizationId, id);

      await Promise.all(
        payment.allocations.map(({ amount, debt }) =>
          store.updateDebt(
            organizationId,
            debt.id,
            debtPaymentState(debt, debt.paidAmount.minus(amount)),
          ),
        ),
      );

      return { payment, restoredDebtCount: payment.allocations.length };
    });

    emitAudit(this.events, {
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
    emitAudit(this.events, {
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
      throw forbidden('errors.FORBIDDEN');
    }
    const payment = await store.createPayment(payload);

    await Promise.all(
      payload.allocations.map(({ amount, debt }) =>
        store.updateDebt(
          payload.organizationId,
          debt.id,
          debtPaymentState(debt, debt.paidAmount.plus(amount)),
        ),
      ),
    );

    return payment;
  }
}
