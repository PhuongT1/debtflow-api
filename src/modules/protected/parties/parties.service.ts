import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest } from '@common/errors/app-errors';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event';
import { applyListQuery, type ListQueryResult } from '@common/query';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { partySearchText } from '@common/utils/search-normalization.util';
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessDayRange,
  getBusinessDayRangeForDate,
} from '@common/utils/business-date.util';
import { DebtStatus, DebtType, OrganizationMembershipStatus, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { QueryPartiesDto } from './dto/query-parties.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { buildPartyCreateData, buildPartyUpdateData } from './party-data';
import { compareParties } from './party-sort';

const COMPUTED_BALANCE_FIELDS = new Set(['receivable', 'payable']);

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(organizationId: string, query: QueryPartiesDto, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const { where, orderBy } = applyListQuery<
      Prisma.PartyWhereInput,
      Prisma.PartyOrderByWithRelationInput[]
    >(listQuery, {
      where: this.buildListWhere(organizationId, query),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    // Receivable/payable are derived from the debts, so the database cannot order by them.
    const computedSort = listQuery?.sort.find(({ field }) => COMPUTED_BALANCE_FIELDS.has(field));

    if (computedSort) {
      // Calculate the balance before slicing the page so ordering stays correct across every page.
      const items = await this.prisma.party.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { debts: true } },
        },
      });
      const balances = await this.getBalances(
        items.map((party) => party.id),
        organizationId,
      );
      const sortedItems = items
        .map((party) => ({ ...party, balance: balances.get(party.id) ?? this.emptyBalance() }))
        .sort((left, right) => compareParties(left, right, listQuery!.sort));

      return paginate(
        sortedItems.slice(pagination.skip, pagination.skip + pagination.take),
        sortedItems.length,
        pagination,
      );
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.party.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { debts: true } },
        },
      }),
      this.prisma.party.count({ where }),
    ]);
    const balances = await this.getBalances(
      items.map((party) => party.id),
      organizationId,
    );

    return paginate(
      items.map((party) => ({ ...party, balance: balances.get(party.id) ?? this.emptyBalance() })),
      total,
      pagination,
    );
  }

  detail(organizationId: string, id: string) {
    return this.prisma.party.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        debts: { orderBy: { dueDate: 'asc' } },
      },
    });
  }

  async create(organizationId: string, userId: string, input: CreatePartyDto) {
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

  private async getBalances(partyIds: string[], organizationId?: string) {
    if (partyIds.length === 0) return new Map<string, ReturnType<typeof this.emptyBalance>>();

    const balances = await this.prisma.debt.groupBy({
      where: {
        partyId: { in: partyIds },
        ...(organizationId ? { organizationId } : {}),
        status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] },
      },
      by: ['partyId', 'type'],
      _sum: { originalAmount: true, paidAmount: true },
    });
    const result = new Map<string, ReturnType<typeof this.emptyBalance>>();

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

  private emptyBalance() {
    return { payable: new Prisma.Decimal(0), receivable: new Prisma.Decimal(0) };
  }

  /** The assignee must be an active member of the same organization (never a user of another tenant). */
  private async assertAssignee(organizationId: string, userId?: string | null) {
    if (!userId) return;

    const member = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        user: { status: 'ACTIVE' },
      },
      select: { id: true },
    });

    if (!member) throw badRequest('parties.ASSIGNEE_NOT_FOUND');
  }

  private buildListWhere(organizationId: string, query: QueryPartiesDto): Prisma.PartyWhereInput {
    const createdAt = this.createdAtFilter(query);

    const searchText = query.q ? partySearchText(query.q) : undefined;

    return {
      organizationId,
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.balanceType
        ? {
            debts: {
              some: {
                status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] },
                type: query.balanceType,
              },
            },
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(searchText
        ? {
            searchText: { contains: searchText },
          }
        : {}),
    };
  }

  private createdRange(range: string): Prisma.DateTimeFilter | undefined {
    const { start } = getBusinessDayRange();

    if (range === 'today') {
      return { gte: start };
    }

    if (range === 'last_7_days') {
      return { gte: addBusinessDays(start, -6) };
    }

    if (range === 'this_month') {
      return { gte: getBusinessDayRangeForDate(`${formatBusinessDate().slice(0, 7)}-01`).start };
    }

    return undefined;
  }

  private createdAtFilter(query: QueryPartiesDto): Prisma.DateTimeFilter | undefined {
    if (!query.createdFrom && !query.createdTo) {
      return query.createdRange ? this.createdRange(query.createdRange) : undefined;
    }

    let from: Date | undefined;
    let to: Date | undefined;
    try {
      from = query.createdFrom ? getBusinessDayRangeForDate(query.createdFrom).start : undefined;
      to = query.createdTo ? getBusinessDayRangeForDate(query.createdTo).end : undefined;
    } catch {
      throw badRequest('parties.INVALID_DATE_RANGE');
    }

    if (from && to && from > to) {
      throw badRequest('parties.INVALID_DATE_RANGE');
    }

    return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }
}
