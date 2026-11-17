import type { ListQueryOptions, SortItem } from '@common/query/list-query-options.types.js';
import { buildPrismaWhere } from '@common/query/list-query-filter.js';
import { buildPrismaOrderBy } from '@common/query/list-query-sort.js';
import { getPagination, paginate, type Pagination } from '@common/utils/pagination.util.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { PrismaService } from '@database/prisma.service.js';
import { serializableTransaction } from '@database/serializable-transaction.js';
import {
  DebtStatus,
  DebtType,
  OrganizationMembershipStatus,
  OrganizationStatus,
  UserStatus,
  Prisma,
} from '@generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import type { PartyListInput } from '../application/party.inputs.js';
import type { PartyRecord } from '../application/party-read.types.js';
import type { PartyDetail } from '../application/party-read.types.js';
import { PARTY_LIST_QUERY } from '../party.list-query.js';
import { buildPartyQuery, PARTY_BALANCE_STATUSES } from './queries/party.query.js';
import { partyBalancePageSql } from './sql/party-balance-page.sql.js';
import {
  partyListSelect,
  partyDetailSelect,
  PARTY_DEFAULT_SELECT,
} from './queries/party.select.js';
import type { PartyBalance, PartyWithBalance } from '../application/party-read.types.js';

import {
  PartiesRepository,
  type PartyWriteStore,
} from '../application/repositories/parties.repository.js';
import type { PartyWriteData } from '../application/party.inputs.js';

type PartyDatabaseRecord = Prisma.PartyGetPayload<{ select: typeof PARTY_DEFAULT_SELECT }>;
type PartyListRecord = Prisma.PartyGetPayload<{ select: ReturnType<typeof partyListSelect> }>;
type PartyDatabaseBalance = { receivable: Prisma.Decimal; payable: Prisma.Decimal };
type PartyBalanceRow = Pick<PartyDatabaseRecord, 'id'> & PartyDatabaseBalance;

@Injectable()
export class PrismaPartiesRepository extends PartiesRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async list(organizationId: string, query: PartyListInput, options?: ListQueryOptions) {
    requireOrganizationId(organizationId);
    const listQuery = options
      ? {
          options,
          sort: options.sort,
          where: buildPrismaWhere(options.filter, PARTY_LIST_QUERY),
          orderBy: options.sort.length
            ? buildPrismaOrderBy(options.sort, PARTY_LIST_QUERY)
            : undefined,
        }
      : undefined;
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
      return {
        ...this.toRecord(item),
        assignedTo: item.assignedTo,
        _count: item._count,
        balance: this.toBalance({ receivable, payable }),
      };
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
      ...this.toRecord(party),
      assignedTo: party.assignedTo,
      _count: party._count,
      balance: this.toBalance(balances.get(party.id) ?? this.emptyBalance()),
    }));
  }

  async detail(organizationId: string, id: string): Promise<PartyDetail> {
    const record = await this.prisma.party.findFirstOrThrow({
      where: { id, organizationId },
      select: partyDetailSelect(organizationId),
    });
    return {
      ...this.toRecord(record),
      assignedTo: record.assignedTo,
      debts: record.debts.map((debt) => ({
        ...debt,
        originalAmount: debt.originalAmount.toString(),
        paidAmount: debt.paidAmount.toString(),
      })),
    };
  }
  async isActive(organizationId: string, id: string) {
    return Boolean(
      await this.prisma.party.findFirst({
        where: { id, organizationId, isActive: true },
        select: { id: true },
      }),
    );
  }
  async create(organizationId: string, userId: string, data: PartyWriteData): Promise<PartyRecord> {
    const record = await this.prisma.party.create({
      data: { organizationId, createdById: userId, ...data },
      select: PARTY_DEFAULT_SELECT,
    });
    return this.toRecord(record);
  }
  /** Same serializable boundary as debt creation: retry the entire read/check/write on conflict. */
  inTransaction<T>(work: (store: PartyWriteStore) => Promise<T>): Promise<T> {
    return serializableTransaction(this.prisma, (tx) =>
      work({
        findRecord: async (organizationId, id) =>
          this.toRecord(
            await tx.party.findFirstOrThrow({
              where: { id, organizationId },
              select: PARTY_DEFAULT_SELECT,
            }),
          ),
        hasActiveMember: async (organizationId, userId) =>
          Boolean(
            await tx.organizationMembership.findFirst({
              where: {
                organizationId,
                userId,
                status: OrganizationMembershipStatus.ACTIVE,
                user: { status: UserStatus.ACTIVE },
                organization: { status: OrganizationStatus.ACTIVE },
              },
              select: { id: true },
            }),
          ),
        update: async (organizationId, id, data) =>
          this.toRecord(
            await tx.party.update({
              where: { id, organizationId },
              data,
              select: PARTY_DEFAULT_SELECT,
            }),
          ),
        countActiveDebts: (organizationId, partyId) =>
          tx.debt.count({
            where: {
              organizationId,
              partyId,
              status: { notIn: [DebtStatus.PAID, DebtStatus.CANCELLED] },
            },
          }),
        deactivate: async (organizationId, id) =>
          this.toRecord(
            await tx.party.update({
              where: { id, organizationId },
              data: { isActive: false },
              select: PARTY_DEFAULT_SELECT,
            }),
          ),
      }),
    );
  }
  private async getBalances(
    partyIds: string[],
    organizationId: string,
    db: Prisma.TransactionClient,
  ) {
    requireOrganizationId(organizationId);
    if (partyIds.length === 0) return new Map<string, PartyDatabaseBalance>();

    const balances = await db.debt.groupBy({
      where: {
        partyId: { in: partyIds },
        organizationId,
        status: { in: PARTY_BALANCE_STATUSES },
      },
      by: ['partyId', 'type'],
      _sum: { originalAmount: true, paidAmount: true },
    });
    const result = new Map<string, PartyDatabaseBalance>();

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

  private toRecord(record: PartyDatabaseRecord): PartyRecord {
    return { ...record, creditLimit: record.creditLimit?.toString() ?? null };
  }

  private toBalance(balance: PartyDatabaseBalance): PartyBalance {
    return { receivable: balance.receivable.toString(), payable: balance.payable.toString() };
  }

  private emptyBalance(): PartyDatabaseBalance {
    return { payable: new Prisma.Decimal(0), receivable: new Prisma.Decimal(0) };
  }
}
