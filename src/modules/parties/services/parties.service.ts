import { partyListInclude } from '../queries/party.select.js';
import { buildPartyQuery } from '../queries/parties.query.js';
import type {
  PartyBalance,
  PartyBalanceRow,
  PartyListRecord,
  PartyWithBalance,
} from '../types/party.types.js';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest, notFound } from '@common/errors/app-errors.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event.js';
import type { ListQueryResult, SortItem } from '@common/query/index.js';
import { getPagination, paginate, type Pagination } from '@common/utils/pagination.util.js';
import { DebtStatus, DebtType, Prisma } from '@generated/prisma/client.js';
import { OrganizationMembersService } from '@modules/users/public/users.js';
import { PrismaService } from '@database/prisma.service.js';
import { CreatePartyDto } from '../dto/create-party.dto.js';
import { QueryPartiesDto } from '../dto/query-parties.dto.js';
import { UpdatePartyDto } from '../dto/update-party.dto.js';
import { buildPartyCreateData, buildPartyUpdateData } from '../mappers/party.mapper.js';
import { partyBalancePageSql } from '../queries/party-balance-page.query.js';
import { PARTY_LIST_QUERY } from '../queries/parties.list-query.js';

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly members: OrganizationMembersService,
  ) {}

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
            include: partyListInclude(organizationId),
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
      include: partyListInclude(organizationId),
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
    requireOrganizationId(organizationId);
    return this.prisma.party.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        debts: { orderBy: { dueDate: 'asc' } },
      },
    });
  }

  async assertActive(
    organizationId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    requireOrganizationId(organizationId);
    const party = await db.party.findFirst({
      where: { id, organizationId, isActive: true },
      select: { id: true },
    });
    if (!party) throw notFound('parties.PARTY_NOT_FOUND');
  }

  async create(organizationId: string, userId: string, input: CreatePartyDto) {
    requireOrganizationId(organizationId);
    const data = buildPartyCreateData(input);
    await this.assertAssignee(organizationId, data.assignedToId);

    const party = await this.prisma.party.create({
      data: { organizationId, createdById: userId, ...data },
    });

    emitAudit(this.events, {
      organizationId,
      actorId: userId,
      entityType: 'Party',
      entityId: party.id,
      action: AuditAction.PartyCreated,
      after: scalarSnapshot(party),
    });

    return party;
  }

  async update(organizationId: string, id: string, input: UpdatePartyDto, actorId?: string) {
    const before = await this.detail(organizationId, id);
    const data = buildPartyUpdateData(input, before);
    if (data.assignedToId) await this.assertAssignee(organizationId, data.assignedToId);

    const party = await this.prisma.party.update({ where: { id }, data });

    emitAudit(this.events, {
      organizationId,
      actorId,
      entityType: 'Party',
      entityId: id,
      action: AuditAction.PartyUpdated,
      before: scalarSnapshot(before),
      after: scalarSnapshot(party),
    });

    return party;
  }

  async deactivate(organizationId: string, id: string, actorId?: string) {
    const before = await this.detail(organizationId, id);
    const activeDebtCount = await this.prisma.debt.count({
      where: { organizationId, partyId: id, status: { notIn: ['PAID', 'CANCELLED'] } },
    });

    if (activeDebtCount > 0) {
      throw badRequest('parties.CANNOT_DELETE_ACTIVE_DEBTS');
    }

    const party = await this.prisma.party.update({ where: { id }, data: { isActive: false } });

    emitAudit(this.events, {
      organizationId,
      actorId,
      entityType: 'Party',
      entityId: id,
      action: AuditAction.PartyDeactivated,
      before: scalarSnapshot(before),
      after: scalarSnapshot(party),
    });

    return party;
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
        status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] },
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

  /** The assignee must be an active member of the same organization (never a user of another tenant). */
  private async assertAssignee(organizationId: string, userId?: string | null) {
    if (!userId) return;

    if (!(await this.members.isActive(organizationId, userId)))
      throw badRequest('parties.ASSIGNEE_NOT_FOUND');
  }
}
