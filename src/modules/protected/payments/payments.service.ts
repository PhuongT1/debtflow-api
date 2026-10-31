import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest } from '@common/errors/app-errors';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event';
import { applyListQuery, type ListQueryResult } from '@common/query';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { DebtStatus, PaymentMethod, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreateAllocatedPaymentDto } from './dto/create-allocated-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';

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
    const payment = await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirstOrThrow({ where: { id: debtId, organizationId } });
      const amount = this.validateAmount(input.amount);
      this.assertPayable(debt, amount);

      return this.createVoucher(tx, {
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
    organizationId = 'org_legacy_debtflow',
    createdById?: string,
  ) {
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
        allocations,
        input: { ...input, createdById },
        partyId: input.partyId,
        type: input.type,
      });
    });

    this.auditCreated(payment, organizationId, createdById);

    return payment;
  }

  async list(
    query: QueryPaymentsDto,
    organizationId = 'org_legacy_debtflow',
    listQuery?: ListQueryResult,
  ) {
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
        include: this.paymentDetails(),
      }),
      this.prisma.payment.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  async remove(id: string, organizationId = 'org_legacy_debtflow', actorId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirstOrThrow({
        where: { id, organizationId },
        include: { allocations: { include: { debt: true } } },
      });
      await tx.payment.delete({ where: { id } });

      await Promise.all(
        payment.allocations.map(({ amount, debt }) =>
          tx.debt.update({
            where: { id: debt.id },
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
    payment: { id: string; allocations: Array<{ debtId: string; amount: Prisma.Decimal }> },
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

  private paymentSnapshot(payment: {
    allocations: Array<{ debtId: string; amount: Prisma.Decimal }>;
  }) {
    return {
      ...scalarSnapshot(payment),
      allocations: payment.allocations.map(({ debtId, amount }) => ({
        debtId,
        amount: amount.toString(),
      })),
    };
  }

  private async createVoucher(
    tx: Prisma.TransactionClient,
    payload: {
      partyId: string;
      type: 'PAYABLE' | 'RECEIVABLE';
      input: CreatePaymentDto & { createdById?: string };
      allocations: Array<{
        amount: Prisma.Decimal;
        debt: {
          id: string;
          organizationId: string;
          originalAmount: Prisma.Decimal;
          paidAmount: Prisma.Decimal;
          status: DebtStatus;
        };
      }>;
    },
  ) {
    const payment = await tx.payment.create({
      data: {
        organizationId: payload.allocations[0].debt.organizationId ?? 'org_legacy_debtflow',
        partyId: payload.partyId,
        type: payload.type,
        amount: payload.allocations.reduce(
          (total, allocation) => total.plus(allocation.amount),
          new Prisma.Decimal(0),
        ),
        paidAt: new Date(payload.input.paidAt),
        method: payload.input.method ?? PaymentMethod.BANK_TRANSFER,
        referenceNo: this.nullable(payload.input.referenceNo),
        note: this.nullable(payload.input.note),
        createdById: (payload.input as CreatePaymentDto & { createdById?: string }).createdById,
        allocations: {
          create: payload.allocations.map((allocation) => ({
            amount: allocation.amount,
            debtId: allocation.debt.id,
          })),
        },
      },
      include: this.paymentDetails(),
    });

    await Promise.all(
      payload.allocations.map(({ amount, debt }) =>
        tx.debt.update({
          where: { id: debt.id },
          data: this.debtPaymentState(debt, debt.paidAmount.plus(amount)),
        }),
      ),
    );

    return payment;
  }

  private paymentDetails() {
    return {
      party: { select: { id: true, name: true } },
      allocations: {
        include: { debt: { include: { party: true } } },
        orderBy: { debt: { dueDate: 'asc' } },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    } satisfies Prisma.PaymentInclude;
  }

  private assertPayable(
    debt: { originalAmount: Prisma.Decimal; paidAmount: Prisma.Decimal; status: DebtStatus },
    amount: Prisma.Decimal,
  ) {
    if (debt.status === DebtStatus.CANCELLED)
      throw badRequest('payments.CANNOT_PAY_CANCELLED_DEBT');
    if (debt.status === DebtStatus.PAID) throw badRequest('payments.DEBT_FULLY_PAID');
    if (amount.greaterThan(debt.originalAmount.minus(debt.paidAmount))) {
      throw badRequest('payments.AMOUNT_EXCEEDS_REMAINING');
    }
  }

  private debtPaymentState(debt: { originalAmount: Prisma.Decimal }, paidAmount: Prisma.Decimal) {
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

  private nullable(value: unknown) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }
}
