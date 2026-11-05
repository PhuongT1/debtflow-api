import type { ListQueryResult } from '@common/query/index.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { PrismaService } from '@database/prisma.service.js';
import { serializableTransaction } from '@database/serializable-transaction.js';
import { DebtStatus, PaymentMethod, Prisma } from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import type { QueryPaymentsDto } from '../dto/query-payments.dto.js';
import { PAYMENT_DETAILS_INCLUDE } from '../queries/payment.select.js';
import { buildPaymentsQuery } from '../queries/payments.query.js';
import { PaymentsRepository, type PaymentWriteStore } from '../repositories/payments.repository.js';

@Injectable()
export class PrismaPaymentsRepository extends PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async list(query: QueryPaymentsDto, organizationId: string, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const { where, orderBy } = buildPaymentsQuery(organizationId, query, listQuery);
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
                create: payload.allocations.map(({ amount, debt }) => ({
                  amount,
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
        deletePayment: async (organizationId, id) => {
          await tx.payment.delete({ where: { id, organizationId } });
        },
        updateDebt: async (organizationId, id, data) => {
          await tx.debt.update({ where: { id, organizationId }, data });
        },
      }),
    );
  }
}
