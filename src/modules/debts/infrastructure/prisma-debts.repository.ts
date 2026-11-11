import type { ListQueryResult } from '@common/query/index.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { PrismaService } from '@database/prisma.service.js';
import { serializableTransaction } from '@database/serializable-transaction.js';
import { Injectable } from '@nestjs/common';
import type { QueryDebtsDto } from '../dto/query-debts.dto.js';
import { buildDebtQuery } from '../queries/debt-query.js';
import { DEBT_DETAIL_INCLUDE, DEBT_LIST_INCLUDE } from '../queries/debt.select.js';
import { DebtsRepository, type DebtWriteStore } from '../repositories/debts.repository.js';

@Injectable()
export class PrismaDebtsRepository extends DebtsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async list(organizationId: string, query: QueryDebtsDto, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const { where, orderBy } = buildDebtQuery(organizationId, query, listQuery);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.debt.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: DEBT_LIST_INCLUDE,
      }),
      this.prisma.debt.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }
  detail(id: string, organizationId: string) {
    return this.prisma.debt.findFirstOrThrow({
      where: { id, organizationId },
      include: DEBT_DETAIL_INCLUDE,
    });
  }
  inTransaction<T>(work: (store: DebtWriteStore) => Promise<T>): Promise<T> {
    return serializableTransaction(this.prisma, (tx) =>
      work({
        hasActiveParty: async (organizationId, id) =>
          Boolean(
            await tx.party.findFirst({
              where: { id, organizationId, isActive: true },
              select: { id: true },
            }),
          ),
        hasActiveMember: async (organizationId, userId) =>
          Boolean(
            await tx.organizationMembership.findFirst({
              where: {
                organizationId,
                userId,
                status: 'ACTIVE',
                user: { status: 'ACTIVE' },
                organization: { status: 'ACTIVE' },
              },
              select: { id: true },
            }),
          ),
        products: (organizationId, ids) =>
          tx.product.findMany({
            where: { organizationId, id: { in: ids }, isActive: true },
            include: { brand: true, category: true },
          }),
        nextCode: async (organizationId, prefix) => {
          const count = await tx.debt.count({
            where: { organizationId, code: { startsWith: prefix } },
          });
          return `${prefix}-${String(count + 1).padStart(4, '0')}`;
        },
        create: ({ items, ...data }) =>
          tx.debt.create({
            data: { ...data, ...(items?.length ? { items: { create: items } } : {}) },
            include: { party: true },
          }),
        updateCollection: (organizationId, id, data) =>
          tx.debt.update({
            where: { id, organizationId },
            data,
            include: { party: true, assignedTo: { select: { id: true, name: true, email: true } } },
          }),
        findForCancellation: (organizationId, id) =>
          tx.debt.findUniqueOrThrow({
            where: { id, organizationId },
            include: { paymentAllocations: true },
          }),
        cancel: (organizationId, id) =>
          tx.debt.update({ where: { id, organizationId }, data: { status: 'CANCELLED' } }),
      }),
    );
  }
}
