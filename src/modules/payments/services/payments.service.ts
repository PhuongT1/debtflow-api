import { PAYMENT_DETAILS_INCLUDE } from '../queries/payment.select';
import type { PaymentWithDetails, PaymentAuditSource, VoucherInput } from '../types/payment.types';
import { normalizeOptionalText } from '@common/utils/optional-text.util';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest, forbidden } from '@common/errors/app-errors';
import { requireOrganizationId } from '@common/validation/require-organization-id';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event';
import { applyListQuery, type ListQueryResult } from '@common/query';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { DebtStatus, PaymentMethod, Prisma, type Debt } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreateAllocatedPaymentDto } from '../dto/create-allocated-payment.dto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { QueryPaymentsDto } from '../dto/query-payments.dto';

const ACTIVE_DEBT_STATUSES = [DebtStatus.OPEN, DebtStatus.PARTIAL];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    debtId: string,
    input: CreatePaymentDto,
    organizationId: string,
    createdById?: string,
  ) {
    requireOrganizationId(organizationId);
    const payment = await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirstOrThrow({ where: { id: debtId, organizationId } });
      const amount = this.validateAmount(input.amount);
      this.assertPayable(debt, amount);

      return this.createVoucher(tx, {
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
    const payment = await this.prisma.$transaction(async (tx) => {
      const amount = this.validateAmount(input.amount);
      const debts = await tx.debt.findMany({
        where: {
          organizationId,
          partyId: input.partyId,
          status: { in: ACTIVE_DEBT_STATUSES },
          type: input.type,
        },
        orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }, { createdAt: 'asc' }],
      });
      let unapplied = amount;
      const allocations: Array<{ amount: Prisma.Decimal; debt: (typeof debts)[number] }> = [];

      for (const debt of debts) {
        if (unapplied.lessThanOrEqualTo(0)) break;
        const remaining = debt.originalAmount.minus(debt.paidAmount);
        if (remaining.lessThanOrEqualTo(0)) continue;
        const allocated = Prisma.Decimal.min(remaining, unapplied);
        allocations.push({ amount: allocated, debt });
        unapplied = unapplied.minus(allocated);
      }

      if (unapplied.greaterThan(0)) {
        throw badRequest('payments.AMOUNT_EXCEEDS_PARTY_BALANCE');
      }
      if (allocations.length === 0) {
        throw badRequest('payments.NO_DEBT_TO_ALLOCATE');
      }

      return this.createVoucher(tx, {
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
    const pagination = getPagination(query);
    const baseWhere: Prisma.PaymentWhereInput = {
      organizationId,
      ...(query.debtId ? { allocations: { some: { debtId: query.debtId } } } : {}),
      ...(query.partyId ? { partyId: query.partyId } : {}),
    };
    const { where, orderBy } = applyListQuery<
      Prisma.PaymentWhereInput,
      Prisma.PaymentOrderByWithRelationInput[]
    >(listQuery, { where: baseWhere, orderBy: [{ paidAt: 'desc' }] });
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: PAYMENT_DETAILS_INCLUDE,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  async remove(id: string, organizationId: string, actorId?: string) {
    requireOrganizationId(organizationId);
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirstOrThrow({
        where: { id, organizationId },
        include: { allocations: { include: { debt: true } } },
      });
      if (payment.allocations.some(({ debt }) => debt.organizationId !== organizationId)) {
        throw forbidden('errors.FORBIDDEN');
      }
      await tx.payment.delete({ where: { id, organizationId } });

      await Promise.all(
        payment.allocations.map(({ amount, debt }) =>
          tx.debt.update({
            where: { id: debt.id, organizationId },
            data: this.debtPaymentState(debt, debt.paidAmount.minus(amount)),
          }),
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

  private async createVoucher(tx: Prisma.TransactionClient, payload: VoucherInput) {
    requireOrganizationId(payload.organizationId);
    if (payload.allocations.some(({ debt }) => debt.organizationId !== payload.organizationId)) {
      throw forbidden('errors.FORBIDDEN');
    }
    const payment = await tx.payment.create({
      data: {
        organizationId: payload.organizationId,
        partyId: payload.partyId,
        type: payload.type,
        amount: payload.allocations.reduce(
          (total, allocation) => total.plus(allocation.amount),
          new Prisma.Decimal(0),
        ),
        paidAt: new Date(payload.input.paidAt),
        method: payload.input.method ?? PaymentMethod.BANK_TRANSFER,
        referenceNo: normalizeOptionalText(payload.input.referenceNo),
        note: normalizeOptionalText(payload.input.note),
        createdById: payload.input.createdById,
        allocations: {
          create: payload.allocations.map((allocation) => ({
            amount: allocation.amount,
            debtId: allocation.debt.id,
          })),
        },
      },
      include: PAYMENT_DETAILS_INCLUDE,
    });

    await Promise.all(
      payload.allocations.map(({ amount, debt }) =>
        tx.debt.update({
          where: { id: debt.id, organizationId: payload.organizationId },
          data: this.debtPaymentState(debt, debt.paidAmount.plus(amount)),
        }),
      ),
    );

    return payment;
  }

  private assertPayable(
    debt: Pick<Debt, 'originalAmount' | 'paidAmount' | 'status'>,
    amount: Prisma.Decimal,
  ) {
    if (debt.status === DebtStatus.CANCELLED)
      throw badRequest('payments.CANNOT_PAY_CANCELLED_DEBT');
    if (debt.status === DebtStatus.PAID) throw badRequest('payments.DEBT_FULLY_PAID');
    if (amount.greaterThan(debt.originalAmount.minus(debt.paidAmount))) {
      throw badRequest('payments.AMOUNT_EXCEEDS_REMAINING');
    }
  }

  private debtPaymentState(debt: Pick<Debt, 'originalAmount'>, paidAmount: Prisma.Decimal) {
    const nextPaidAmount = Prisma.Decimal.max(paidAmount, new Prisma.Decimal(0));
    const status = nextPaidAmount.greaterThanOrEqualTo(debt.originalAmount)
      ? DebtStatus.PAID
      : nextPaidAmount.lessThanOrEqualTo(0)
        ? DebtStatus.OPEN
        : DebtStatus.PARTIAL;

    return { paidAmount: nextPaidAmount, status };
  }

  private validateAmount(value: string) {
    const amount = new Prisma.Decimal(value);
    if (amount.lessThanOrEqualTo(0)) throw badRequest('payments.AMOUNT_MUST_BE_POSITIVE');
    return amount;
  }
}
