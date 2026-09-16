import { BadRequestException, Injectable } from '@nestjs/common';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { DebtStatus, DebtType, PartyType, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { PartySummarySortBy, QueryPartiesDto, SortOrder } from './dto/query-parties.dto';
import { UpdatePartyDto } from './dto/update-party.dto';

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: QueryPartiesDto) {
    const pagination = getPagination(query);
    const where = this.buildListWhere(organizationId, query);

    if (
      query.sortBy === PartySummarySortBy.RECEIVABLE ||
      query.sortBy === PartySummarySortBy.PAYABLE
    ) {
      // Balance is derived from originalAmount - paidAmount. Calculate it before
      // slicing the page so ordering remains correct across every page.
      const items = await this.prisma.party.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { debts: true } },
        },
      });
      const balances = await this.getBalances(items.map((party) => party.id), organizationId);
      const balanceKey = query.sortBy === PartySummarySortBy.RECEIVABLE ? 'receivable' : 'payable';
      const direction = query.sortOrder === SortOrder.DESC ? -1 : 1;
      const sortedItems = items
        .map((party) => ({ ...party, balance: balances.get(party.id) ?? this.emptyBalance() }))
        .sort((left, right) => {
          const compared = left.balance[balanceKey].comparedTo(right.balance[balanceKey]);
          return compared === 0 ? left.name.localeCompare(right.name) : compared * direction;
        });

      return paginate(sortedItems.slice(pagination.skip, pagination.skip + pagination.take), sortedItems.length, pagination);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.party.findMany({
        where,
        orderBy: this.buildListOrderBy(query),
        skip: pagination.skip,
        take: pagination.take,
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { debts: true } },
        },
      }),
      this.prisma.party.count({ where }),
    ]);
    const balances = await this.getBalances(items.map((party) => party.id), organizationId);

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

  create(organizationId: string, userId: string, input: CreatePartyDto) {
    return this.prisma.party.create({
      data: { organizationId, createdById: userId, ...this.toPartyData(input) },
    });
  }

  async update(organizationId: string, id: string, input: UpdatePartyDto) {
    await this.detail(organizationId, id);
    return this.prisma.party.update({
      where: { id },
      data: this.toPartyData(input),
    });
  }

  async deactivate(organizationId: string, id: string) {
    await this.detail(organizationId, id);
    const activeDebtCount = await this.prisma.debt.count({
      where: { organizationId, partyId: id, status: { notIn: ['PAID', 'CANCELLED'] } },
    });

    if (activeDebtCount > 0) {
      throw new BadRequestException('Không thể xóa khách còn công nợ chưa tất toán');
    }

    return this.prisma.party.update({ where: { id }, data: { isActive: false } });
  }

  private buildListOrderBy(query: QueryPartiesDto): Prisma.PartyOrderByWithRelationInput[] {
    const direction = query.sortOrder === SortOrder.DESC ? 'desc' : 'asc';

    switch (query.sortBy) {
      case PartySummarySortBy.OUTSTANDING_DOCUMENTS:
        return [{ debts: { _count: direction } }, { name: 'asc' }, { id: 'asc' }];
      case PartySummarySortBy.NAME:
      default:
        return [{ name: direction }, { id: 'asc' }];
    }
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

  private toPartyData(input: CreatePartyDto | UpdatePartyDto): Omit<Prisma.PartyUncheckedCreateInput, 'organizationId'> {
    return {
      type: (input.type as PartyType) ?? 'CUSTOMER',
      code: this.nullable(input.code),
      name: String(input.name ?? '').trim(),
      phone: this.nullable(input.phone),
      email: this.nullable(input.email),
      taxCode: this.nullable(input.taxCode),
      address: this.nullable(input.address),
      provinceCode: this.nullable(input.provinceCode)?.toUpperCase(),
      provinceName: this.nullable(input.provinceName),
      note: this.nullable(input.note),
      creditLimit:
        input.creditLimit === '' || input.creditLimit == null
          ? null
          : new Prisma.Decimal(String(input.creditLimit)),
      assignedToId: this.nullable(input.assignedToId),
    };
  }

  private nullable(value: unknown) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }

  private buildListWhere(organizationId: string, query: QueryPartiesDto): Prisma.PartyWhereInput {
    const createdAt = this.createdAtFilter(query);

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
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { code: { contains: query.q, mode: 'insensitive' } },
              { phone: { contains: query.q, mode: 'insensitive' } },
              { taxCode: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private createdRange(range: string): Prisma.DateTimeFilter | undefined {
    const now = new Date();
    const start = new Date(now);

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    }

    if (range === 'last_7_days') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    }

    if (range === 'this_month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { gte: start };
    }

    return undefined;
  }

  private createdAtFilter(query: QueryPartiesDto): Prisma.DateTimeFilter | undefined {
    if (!query.createdFrom && !query.createdTo) {
      return query.createdRange ? this.createdRange(query.createdRange) : undefined;
    }

    const from = query.createdFrom ? new Date(`${query.createdFrom}T00:00:00`) : undefined;
    const to = query.createdTo ? new Date(`${query.createdTo}T23:59:59.999`) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc');
    }

    return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }
}
