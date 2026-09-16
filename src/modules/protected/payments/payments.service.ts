import { BadRequestException, Injectable } from '@nestjs/common';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { DebtStatus, PaymentMethod, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreateAllocatedPaymentDto } from './dto/create-allocated-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';

const ACTIVE_DEBT_STATUSES = [DebtStatus.OPEN, DebtStatus.PARTIAL];

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(debtId: string, input: CreatePaymentDto, organizationId: string, createdById?: string) {
    return this.prisma.$transaction(async (tx) => {
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
  }

  async createAutoAllocated(input: CreateAllocatedPaymentDto, organizationId = 'org_legacy_debtflow', createdById?: string) {
    return this.prisma.$transaction(async (tx) => {
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
        throw new BadRequestException('Số tiền thu/chi vượt quá tổng công nợ còn lại của đối tác');
      }
      if (allocations.length === 0) {
        throw new BadRequestException('Đối tác không còn công nợ phù hợp để cấn trừ');
      }

      return this.createVoucher(tx, { allocations, input: { ...input, createdById }, partyId: input.partyId, type: input.type });
    });
  }

  async list(query: QueryPaymentsDto, organizationId = 'org_legacy_debtflow') {
    const pagination = getPagination(query);
    const where: Prisma.PaymentWhereInput = { organizationId,
      ...(query.debtId ? { allocations: { some: { debtId: query.debtId } } } : {}),
      ...(query.partyId ? { partyId: query.partyId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: this.paymentDetails(),
      }),
      this.prisma.payment.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  async remove(id: string, organizationId = 'org_legacy_debtflow') {
    return this.prisma.$transaction(async (tx) => {
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

      return { id, restoredDebtCount: payment.allocations.length };
    });
  }

  private async createVoucher(
    tx: Prisma.TransactionClient,
    payload: {
      partyId: string;
      type: 'PAYABLE' | 'RECEIVABLE';
      input: CreatePaymentDto & { createdById?: string };
      allocations: Array<{ amount: Prisma.Decimal; debt: { id: string; organizationId: string; originalAmount: Prisma.Decimal; paidAmount: Prisma.Decimal; status: DebtStatus } }>;
    },
  ) {
    const payment = await tx.payment.create({
      data: {
        organizationId: payload.allocations[0].debt.organizationId ?? 'org_legacy_debtflow',
        partyId: payload.partyId,
        type: payload.type,
        amount: payload.allocations.reduce((total, allocation) => total.plus(allocation.amount), new Prisma.Decimal(0)),
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
    if (debt.status === DebtStatus.CANCELLED) throw new BadRequestException('Không thể thanh toán công nợ đã hủy');
    if (debt.status === DebtStatus.PAID) throw new BadRequestException('Công nợ đã thanh toán đủ');
    if (amount.greaterThan(debt.originalAmount.minus(debt.paidAmount))) {
      throw new BadRequestException('Số tiền thanh toán vượt quá số dư còn lại');
    }
  }

  private debtPaymentState(
    debt: { originalAmount: Prisma.Decimal },
    paidAmount: Prisma.Decimal,
  ) {
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
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    return amount;
  }

  private nullable(value: unknown) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }
}
