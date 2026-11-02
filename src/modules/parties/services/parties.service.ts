import { PARTY_LIST_INCLUDE } from '../queries/party.select';
import { buildPartyQuery } from '../queries/parties.query';
import type { PartyBalance, PartyListRecord, PartyWithBalance } from '../types/party.types';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest } from '@common/errors/app-errors';
import { requireOrganizationId } from '@common/validation/require-organization-id';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event';
import type { ListQueryResult } from '@common/query';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { DebtStatus, DebtType, OrganizationMembershipStatus, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreatePartyDto } from '../dto/create-party.dto';
import { QueryPartiesDto } from '../dto/query-parties.dto';
import { UpdatePartyDto } from '../dto/update-party.dto';
import { buildPartyCreateData, buildPartyUpdateData } from '../mappers/party.mapper';
import { compareParties } from '../queries/party-sort';

const COMPUTED_BALANCE_FIELDS = new Set(['receivable', 'payable']);

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(organizationId: string, query: QueryPartiesDto, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    const pagination = getPagination(query);
    const { where, orderBy } = buildPartyQuery(organizationId, query, listQuery);
    // Receivable/payable are derived from the debts, so the database cannot order by them.
    const computedSort = listQuery?.sort.find(({ field }) => COMPUTED_BALANCE_FIELDS.has(field));

    if (computedSort) {
      // Calculate the balance before slicing the page so ordering stays correct across every page.
      const items = await this.prisma.party.findMany({
        where,
        include: PARTY_LIST_INCLUDE,
      });
      const sortedItems = (await this.withBalances(items, organizationId)).sort((left, right) =>
        compareParties(left, right, listQuery!.sort),
      );

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
        include: PARTY_LIST_INCLUDE,
      }),
      this.prisma.party.count({ where }),
    ]);
    return paginate(await this.withBalances(items, organizationId), total, pagination);
  }

  private async withBalances(
    items: PartyListRecord[],
    organizationId: string,
  ): Promise<PartyWithBalance[]> {
    const balances = await this.getBalances(
      items.map((party) => party.id),
      organizationId,
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

  private async getBalances(partyIds: string[], organizationId: string) {
    requireOrganizationId(organizationId);
    if (partyIds.length === 0) return new Map<string, PartyBalance>();

    const balances = await this.prisma.debt.groupBy({
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
}
