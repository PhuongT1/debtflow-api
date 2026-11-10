import type { ListQueryResult, SortItem } from '@common/query/index.js';
import { getPagination, paginate, type Pagination } from '@common/utils/pagination.util.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { PrismaService } from '@database/prisma.service.js';
import { serializableTransaction } from '@database/serializable-transaction.js';
import { DebtType, Prisma } from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import { QueryPartiesDto } from '../dto/query-parties.dto.js';
import { PARTY_LIST_QUERY } from '../queries/party.list-query.js';
import { buildPartyQuery, PARTY_BALANCE_STATUSES } from '../queries/party.query.js';
import { partyBalancePageSql } from './sql/party-balance-page.sql.js';
import {
  partyListSelect,
  partyDetailSelect,
  PARTY_DEFAULT_SELECT,
} from '../queries/party.select.js';
import type {
  PartyBalance,
  PartyBalanceRow,
  PartyListRecord,
  PartyWithBalance,
} from '../party.types.js';

import { PartiesRepository, type PartyWriteStore } from '../repositories/parties.repository.js';
import type { PartyWriteData } from '../party.types.js';

@Injectable()
export class PrismaPartiesRepository extends PartiesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async list(organizationId: string, query: QueryPartiesDto, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    const pagination = getPagination(query);
    const { where, orderBy } = buildPartyQuery(organizationId, query, listQuery);
    const sort = listQuery?.sort[0];
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.party.count({ where });
        if (pagination.skip >= total) return paginate([], total, pagination);

        let items: PartyWithBalance[];
        if (sort && PARTY_LIST_QUERY.fields[sort.field]?.computed) {
          items = await this.aggregateSortedPage(tx, organizationId, where, sort, pagination);
        } else {
          const page = await tx.party.findMany({
            where,
            orderBy,
            skip: pagination.skip,
            take: pagination.take,
            select: partyListSelect(organizationId),
          });
          items = await this.withBalances(page, organizationId, tx);
        }
        return paginate(items, total, pagination);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async aggregateSortedPage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    where: Prisma.PartyWhereInput,
    sort: SortItem,
    pagination: Pagination,
  ): Promise<PartyWithBalance[]> {
    const rows = await tx.$queryRaw<PartyBalanceRow[]>(
      partyBalancePageSql(organizationId, where, sort, pagination),
    );
    if (rows.length === 0) return [];
    const items = await tx.party.findMany({
      where: { organizationId, isActive: true, id: { in: rows.map(({ id }) => id) } },
      select: partyListSelect(organizationId),
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    return rows.map(({ id, receivable, payable }) => {
      const item = byId.get(id);
      if (!item) throw new Error('Party list snapshot is inconsistent');
      return { ...item, balance: { receivable, payable } };
    });
  }

  private async withBalances(
    items: PartyListRecord[],
    organizationId: string,
    db: Prisma.TransactionClient,
  ): Promise<PartyWithBalance[]> {
    const balances = await this.getBalances(
      items.map((party) => party.id),
      organizationId,
      db,
    );
    return items.map((party) => ({
      ...party,
      balance: balances.get(party.id) ?? this.emptyBalance(),
    }));
  }

  detail(organizationId: string, id: string) {
    return this.prisma.party.findFirstOrThrow({
      where: { id, organizationId },
      select: partyDetailSelect(organizationId),
    });
  }
  async isActive(organizationId: string, id: string) {
    return Boolean(
      await this.prisma.party.findFirst({
        where: { id, organizationId, isActive: true },
        select: { id: true },
      }),
    );
  }
  create(organizationId: string, userId: string, data: PartyWriteData) {
    return this.prisma.party.create({ data: { organizationId, createdById: userId, ...data } });
  }
  /** Same serializable boundary as debt creation: retry the entire read/check/write on conflict. */
  inTransaction<T>(work: (store: PartyWriteStore) => Promise<T>): Promise<T> {
    return serializableTransaction(this.prisma, (tx) =>
      work({
        findRecord: (organizationId, id) =>
          tx.party.findFirstOrThrow({
            where: { id, organizationId },
            select: PARTY_DEFAULT_SELECT,
          }),
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
        update: (organizationId, id, data) =>
          tx.party.update({ where: { id, organizationId }, data }),
        countActiveDebts: (organizationId, partyId) =>
          tx.debt.count({
            where: { organizationId, partyId, status: { notIn: ['PAID', 'CANCELLED'] } },
          }),
        deactivate: (organizationId, id) =>
          tx.party.update({ where: { id, organizationId }, data: { isActive: false } }),
      }),
    );
  }
  private async getBalances(
    partyIds: string[],
    organizationId: string,
    db: Prisma.TransactionClient,
  ) {
    requireOrganizationId(organizationId);
    if (partyIds.length === 0) return new Map<string, PartyBalance>();

    const balances = await db.debt.groupBy({
      where: {
        partyId: { in: partyIds },
        organizationId,
        status: { in: PARTY_BALANCE_STATUSES },
      },
      by: ['partyId', 'type'],
      _sum: { originalAmount: true, paidAmount: true },
    });
    const result = new Map<string, PartyBalance>();

    balances.forEach((balance) => {
      const current = result.get(balance.partyId) ?? this.emptyBalance();
      const original = balance._sum.originalAmount ?? new Prisma.Decimal(0);
      const paid = balance._sum.paidAmount ?? new Prisma.Decimal(0);
      const remaining = original.minus(paid);

      if (balance.type === DebtType.RECEIVABLE) current.receivable = remaining;
      if (balance.type === DebtType.PAYABLE) current.payable = remaining;
      result.set(balance.partyId, current);
    });

    return result;
  }

  private emptyBalance(): PartyBalance {
    return { payable: new Prisma.Decimal(0), receivable: new Prisma.Decimal(0) };
  }
}
