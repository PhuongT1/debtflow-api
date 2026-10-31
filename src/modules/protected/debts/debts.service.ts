import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest } from '@common/errors/app-errors';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event';
import { applyListQuery, type ListQueryResult } from '@common/query';
import { addBusinessDays, getBusinessDayRange } from '@common/utils/business-date.util';
import { getPagination, paginate } from '@common/utils/pagination.util';
import { CollectionStatus, DebtStatus, DebtType, Prisma } from '@generated/prisma';
import { PrismaService } from '@database/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { DebtLineItemService } from './debt-line-item.service';
import { QueryDebtsDto } from './dto/query-debts.dto';
import { UpdateDebtCollectionDto } from './dto/update-debt-collection.dto';

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debtLineItems: DebtLineItemService,
    private readonly events: EventEmitter2,
  ) {}

  async list(organizationId: string, query: QueryDebtsDto, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const now = new Date();
    const { end: endOfToday, start: startOfToday } = getBusinessDayRange(now);

    const baseWhere: Prisma.DebtWhereInput = {
      organizationId,
      ...(query.type ? { type: query.type as DebtType } : {}),
      ...(query.status ? { status: query.status as DebtStatus } : {}),
      ...(query.collectionStatus
        ? { collectionStatus: query.collectionStatus as CollectionStatus }
        : {}),
      ...(query.partyId ? { partyId: query.partyId } : {}),
      ...(query.provinceCode ? { party: { provinceCode: query.provinceCode } } : {}),
      ...(query.salesChannel ? { salesChannel: query.salesChannel } : {}),
      ...(query.categoryId || query.brandId || query.productId
        ? {
            items: {
              some: {
                product: {
                  ...(query.categoryId ? { categoryId: query.categoryId } : {}),
                  ...(query.brandId ? { brandId: query.brandId } : {}),
                  ...(query.productId ? { id: query.productId } : {}),
                },
              },
            },
          }
        : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...this.agingWhere(query.aging, now),
      ...this.followUpWhere(query.followUp, startOfToday, endOfToday),
      ...this.dueRangeWhere(query.dueRange, startOfToday, endOfToday),
      ...this.exactDueDateWhere(query.dueDate),
      ...this.customDueDateRangeWhere(query.dueDateFrom, query.dueDateTo),
      ...(query.outstanding === 'true'
        ? { status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] } }
        : {}),
      ...(query.outstanding === 'false' ? { status: DebtStatus.PAID } : {}),
      ...(query.overdue === 'true'
        ? { dueDate: { lt: startOfToday }, status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' } },
              { title: { contains: query.q, mode: 'insensitive' } },
              { invoiceNo: { contains: query.q, mode: 'insensitive' } },
              { orderNo: { contains: query.q, mode: 'insensitive' } },
              { contractNo: { contains: query.q, mode: 'insensitive' } },
              { poNo: { contains: query.q, mode: 'insensitive' } },
              { party: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const { where, orderBy } = applyListQuery<
      Prisma.DebtWhereInput,
      Prisma.DebtOrderByWithRelationInput[]
    >(listQuery, {
      where: baseWhere,
      orderBy: query.overdue === 'true' ? [{ dueDate: 'asc' }] : [{ createdAt: 'desc' }],
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.debt.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          party: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          items: {
            select: {
              id: true,
              productName: true,
              categoryName: true,
              brandName: true,
              quantity: true,
              unit: true,
              lineAmount: true,
            },
          },
          _count: { select: { paymentAllocations: true } },
        },
      }),
      this.prisma.debt.count({ where }),
    ]);

    return paginate(items, total, pagination);
  }

  async detail(id: string, organizationId: string) {
    const debt = await this.prisma.debt.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        party: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        items: { include: { product: { include: { brand: true, category: true } } } },
        paymentAllocations: {
          orderBy: { payment: { paidAt: 'desc' } },
          include: {
            payment: { include: { createdBy: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });

    return {
      ...debt,
      payments: debt.paymentAllocations.map(({ amount, payment }) => ({ ...payment, amount })),
    };
  }

  async create(input: CreateDebtDto, organizationId: string, userId: string) {
    const issueDate = new Date(input.issueDate);
    const dueDate = new Date(input.dueDate);
    const originalAmount = new Prisma.Decimal(String(input.originalAmount));
    const items = await this.debtLineItems.prepare(input.items, originalAmount, organizationId);

    if (dueDate < issueDate) {
      throw badRequest('debts.DUE_DATE_BEFORE_ISSUE');
    }

    const debt = await this.prisma.debt.create({
      data: {
        organizationId,
        code: await this.nextDebtCode(organizationId),
        type: input.type,
        partyId: input.partyId,
        assignedToId: this.nullable(input.assignedToId),
        title: input.title.trim(),
        invoiceNo: this.nullable(input.invoiceNo),
        orderNo: this.nullable(input.orderNo),
        contractNo: this.nullable(input.contractNo),
        poNo: this.nullable(input.poNo),
        description: this.nullable(input.description),
        originalAmount,
        paidAmount: new Prisma.Decimal(0),
        issueDate,
        dueDate,
        status: DebtStatus.OPEN,
        collectionStatus: CollectionStatus.NEW,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(String(input.nextFollowUpAt)) : null,
        followUpNote: this.nullable(input.followUpNote),
        salesChannel: input.salesChannel,
        createdById: userId,
        ...(items.length > 0 ? { items: { create: items } } : {}),
      },
      include: { party: true },
    });

    emitAudit(this.events, {
      organizationId,
      actorId: userId,
      entityType: 'Debt',
      entityId: debt.id,
      action: AuditAction.DebtCreated,
      after: scalarSnapshot(debt),
    });

    return debt;
  }

  async updateCollection(
    id: string,
    input: UpdateDebtCollectionDto,
    organizationId: string,
    actorId?: string,
  ) {
    const before = await this.detail(id, organizationId);
    const debt = await this.prisma.debt.update({
      where: { id },
      data: {
        assignedToId: this.nullable(input.assignedToId),
        collectionStatus: input.collectionStatus,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
        followUpNote: this.nullable(input.followUpNote),
        invoiceNo: this.nullable(input.invoiceNo),
        orderNo: this.nullable(input.orderNo),
        contractNo: this.nullable(input.contractNo),
        poNo: this.nullable(input.poNo),
        description: this.nullable(input.description),
      },
      include: { party: true, assignedTo: { select: { id: true, name: true, email: true } } },
    });

    emitAudit(this.events, {
      organizationId,
      actorId,
      entityType: 'Debt',
      entityId: id,
      action: AuditAction.DebtUpdated,
      before: scalarSnapshot(before),
      after: scalarSnapshot(debt),
    });

    return debt;
  }

  async cancel(id: string, organizationId: string, actorId?: string) {
    const debt = await this.prisma.debt.findUniqueOrThrow({
      where: { id, organizationId },
      include: { paymentAllocations: true },
    });

    if (debt.paymentAllocations.length > 0) {
      throw badRequest('debts.CANNOT_CANCEL_PAID_DEBT');
    }

    const cancelled = await this.prisma.debt.update({
      where: { id },
      data: { status: DebtStatus.CANCELLED },
    });

    emitAudit(this.events, {
      organizationId,
      actorId,
      entityType: 'Debt',
      entityId: id,
      action: AuditAction.DebtCancelled,
      before: scalarSnapshot(debt),
      after: scalarSnapshot(cancelled),
    });

    return cancelled;
  }

  private async nextDebtCode(organizationId = 'org_legacy_debtflow') {
    const now = new Date();
    const prefix = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.debt.count({
      where: { organizationId, code: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private nullable(value: unknown) {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }

  private agingWhere(aging: string | undefined, now: Date): Prisma.DebtWhereInput {
    if (!aging) return {};
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);
    const active = { status: { notIn: [DebtStatus.PAID, DebtStatus.CANCELLED] } };
    if (aging === 'not_due') return { ...active, dueDate: { gte: now } };
    if (aging === '1_7') return { ...active, dueDate: { lt: now, gte: daysAgo(7) } };
    if (aging === '8_30') return { ...active, dueDate: { lt: daysAgo(7), gte: daysAgo(30) } };
    if (aging === '31_60') return { ...active, dueDate: { lt: daysAgo(30), gte: daysAgo(60) } };
    if (aging === '60_plus') return { ...active, dueDate: { lt: daysAgo(60) } };
    return {};
  }

  private followUpWhere(
    followUp: string | undefined,
    start: Date,
    end: Date,
  ): Prisma.DebtWhereInput {
    if (followUp === 'today') return { nextFollowUpAt: { gte: start, lte: end } };
    if (followUp === 'overdue') return { nextFollowUpAt: { lt: start } };
    if (followUp === 'upcoming') return { nextFollowUpAt: { gt: end } };
    return {};
  }

  private dueRangeWhere(
    range: string | undefined,
    startOfToday: Date,
    endOfToday: Date,
  ): Prisma.DebtWhereInput {
    if (!range) return {};
    const start = new Date(startOfToday);
    const end = new Date(endOfToday);
    if (range === 'today') return { dueDate: { gte: start, lte: end } };
    if (range === 'tomorrow') {
      return {
        dueDate: {
          gte: addBusinessDays(start, 1),
          lte: addBusinessDays(end, 1),
        },
      };
    }
    if (range === 'next_7_days') {
      return { dueDate: { gte: start, lte: addBusinessDays(end, 6) } };
    }
    if (range === 'this_month') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { dueDate: { gte: start, lte: end } };
    }
    return {};
  }

  private customDueDateRangeWhere(
    dueDateFrom: string | undefined,
    dueDateTo: string | undefined,
  ): Prisma.DebtWhereInput {
    if (!dueDateFrom && !dueDateTo) return {};

    const from = dueDateFrom ? new Date(dueDateFrom + 'T00:00:00+07:00') : undefined;
    const to = dueDateTo ? new Date(dueDateTo + 'T23:59:59.999+07:00') : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return {};

    return { dueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
  }

  private exactDueDateWhere(dueDate: string | undefined): Prisma.DebtWhereInput {
    if (!dueDate) return {};
    const start = new Date(`${dueDate}T00:00:00+07:00`);
    const end = new Date(`${dueDate}T23:59:59.999+07:00`);
    return Number.isNaN(start.getTime()) ? {} : { dueDate: { gte: start, lte: end } };
  }
}
