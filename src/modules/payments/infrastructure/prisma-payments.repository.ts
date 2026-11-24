import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { prismaDebtMoneyMath } from '@common/utils/money.util.js';
import { compileListQuery } from '@common/query/list-query-builder.js';
import { PAYMENT_LIST_QUERY } from '../payments.list-query.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { PrismaService } from '@database/prisma.service.js';
import { serializableTransaction } from '@database/serializable-transaction.js';
import { DebtStatus, PaymentMethod, Prisma } from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import type { PaymentListInput } from '../application/payment.types.js';
import { PAYMENT_DETAILS_INCLUDE } from './queries/payment.select.js';
import { buildPaymentsQuery } from './queries/payments.query.js';
import {
  PaymentsRepository,
  type PaymentWriteStore,
} from '../application/repositories/payments.repository.js';

@Injectable()
export class PrismaPaymentsRepository extends PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(query: PaymentListInput, organizationId: string, listQuery?: ListQueryOptions) {
    const pagination = getPagination(query);
    const { where, orderBy } = buildPaymentsQuery(
      organizationId,
      query,
      listQuery && compileListQuery(listQuery, PAYMENT_LIST_QUERY),
    );
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

  inTransaction<T>(work: (store: PaymentWriteStore) => Promise<T>): Promise<T> {
    return serializableTransaction(this.prisma, (tx) =>
      work({
        findDebt: (organizationId, id) =>
          tx.debt.findFirstOrThrow({ where: { id, organizationId } }),
        findDebts: (organizationId, partyId, type) =>
          tx.debt.findMany({
            where: {
              organizationId,
              partyId,
              type,
              status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] },
            },
            orderBy: [
              { dueDate: 'asc' },
              { issueDate: 'asc' },
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          }),
        createPayment: (payload) =>
          tx.payment.create({
            data: {
              organizationId: payload.organizationId,
              partyId: payload.partyId,
              type: payload.type,
              amount: prismaDebtMoneyMath.sum(payload.allocations.map(({ amount }) => amount)),
              paidAt: new Date(payload.input.paidAt),
              method: payload.input.method ?? PaymentMethod.BANK_TRANSFER,
              referenceNo: normalizeOptionalText(payload.input.referenceNo),
              note: normalizeOptionalText(payload.input.note),
              createdById: payload.input.createdById,
              allocations: {
                create: payload.allocations.map(({ amount, debt }) => ({
                  amount: new Prisma.Decimal(amount.toString()),
                  debtId: debt.id,
                })),
              },
            },
            include: PAYMENT_DETAILS_INCLUDE,
          }),
        findPayment: (organizationId, id) =>
          tx.payment.findFirstOrThrow({
            where: { id, organizationId },
            include: PAYMENT_DETAILS_INCLUDE,
          }),
        allocationTotals: async (organizationId, debtIds) => {
          const rows = await tx.paymentAllocation.groupBy({
            by: ['debtId'],
            where: { debtId: { in: debtIds }, debt: { organizationId } },
            _sum: { amount: true },
          });
          return new Map(
            rows.map(({ debtId, _sum }) => [debtId, _sum.amount ?? new Prisma.Decimal(0)]),
          );
        },
        deletePayment: async (organizationId, id) => {
          await tx.payment.delete({ where: { id, organizationId } });
        },
        updateDebt: async (organizationId, id, data) => {
          await tx.debt.update({
            where: { id, organizationId },
            data: { ...data, paidAmount: new Prisma.Decimal(data.paidAmount.toString()) },
          });
        },
      }),
    );
  }
}
