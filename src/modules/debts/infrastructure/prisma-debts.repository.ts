import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import { getPagination, paginate } from '@common/utils/pagination.util.js';
import { hasActiveOrganizationMember } from '@database/active-organization-member.query.js';
import { Prisma } from '@generated/prisma/client.js';
import { compileListQuery } from '@common/query/list-query-builder.js';
import { DEBT_LIST_QUERY } from '../debts.list-query.js';
import { PrismaService } from '@database/prisma.service.js';
import { serializableTransaction } from '@database/serializable-transaction.js';
import { Injectable } from '@nestjs/common';
import type { DebtFilters } from '../public/debt-filters.types.js';
import { buildDebtQuery } from './queries/debt-query.js';
import { DEBT_DETAIL_INCLUDE, DEBT_LIST_INCLUDE } from './queries/debt.select.js';
import {
  DebtsRepository,
  type DebtWriteStore,
} from '../application/repositories/debts.repository.js';

@Injectable()
export class PrismaDebtsRepository extends DebtsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async list(organizationId: string, query: DebtFilters, listQuery?: ListQueryOptions) {
    const pagination = getPagination(query);
    const { where, orderBy } = buildDebtQuery(
      organizationId,
      query,
      listQuery && compileListQuery(listQuery, DEBT_LIST_QUERY),
    );
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
        hasActiveMember: (organizationId, userId) =>
          hasActiveOrganizationMember(tx, organizationId, userId),
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
        create: ({ items, originalAmount, paidAmount, ...data }) =>
          tx.debt.create({
            data: {
              ...data,
              originalAmount: new Prisma.Decimal(originalAmount.toString()),
              paidAmount: new Prisma.Decimal(paidAmount.toString()),
              ...(items?.length
                ? {
                    items: {
                      create: items.map(({ quantity, unitPrice, lineAmount, ...item }) => ({
                        ...item,
                        quantity: new Prisma.Decimal(quantity.toString()),
                        unitPrice: new Prisma.Decimal(unitPrice.toString()),
                        lineAmount: new Prisma.Decimal(lineAmount.toString()),
                      })),
                    },
                  }
                : {}),
            },
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
