import { PartiesService } from '#modules/parties/public/parties.js';
import { OrganizationMembersService } from '#modules/users/public/users.js';
import { buildDebtCollectionData } from '../mappers/debt-collection.mapper.js';
import { normalizeOptionalText } from '#common/utils/optional-text.util.js';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest } from '#common/errors/app-errors.js';
import { AuditAction, emitAudit, scalarSnapshot } from '#common/events/audit-event.js';
import type { ListQueryResult } from '#common/query/index.js';
import { requireOrganizationId } from '#common/validation/require-organization-id.js';
import { buildDebtQuery } from '../queries/debt-query.js';
import { getPagination, paginate } from '#common/utils/pagination.util.js';
import { CollectionStatus, DebtStatus, Prisma } from '#generated/prisma/client.js';
import { PrismaService } from '#database/prisma.service.js';
import { CreateDebtDto } from '../dto/create-debt.dto.js';
import { DebtLineItemService } from './debt-line-item.service.js';
import { QueryDebtsDto } from '../dto/query-debts.dto.js';
import { UpdateDebtCollectionDto } from '../dto/update-debt-collection.dto.js';

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debtLineItems: DebtLineItemService,
    private readonly events: EventEmitter2,
    private readonly parties: PartiesService,
    private readonly members: OrganizationMembersService,
  ) {}

  async list(organizationId: string, query: QueryDebtsDto, listQuery?: ListQueryResult) {
    const pagination = getPagination(query);
    const { where, orderBy } = buildDebtQuery(organizationId, query, listQuery);

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
    requireOrganizationId(organizationId);
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
    requireOrganizationId(organizationId);
    const issueDate = new Date(input.issueDate);
    const dueDate = new Date(input.dueDate);
    const originalAmount = new Prisma.Decimal(String(input.originalAmount));

    if (dueDate < issueDate) {
      throw badRequest('debts.DUE_DATE_BEFORE_ISSUE');
    }

    const debt = await this.prisma.$transaction(async (tx) => {
      await this.parties.assertActive(organizationId, input.partyId, tx);
      await this.assertAssignee(organizationId, input.assignedToId, tx);
      const items = await this.debtLineItems.prepare(
        input.items,
        originalAmount,
        organizationId,
        tx,
      );
      return tx.debt.create({
        data: {
          organizationId,
          code: await this.nextDebtCode(organizationId, tx),
          type: input.type,
          partyId: input.partyId,
          assignedToId: normalizeOptionalText(input.assignedToId),
          title: input.title.trim(),
          invoiceNo: normalizeOptionalText(input.invoiceNo),
          orderNo: normalizeOptionalText(input.orderNo),
          contractNo: normalizeOptionalText(input.contractNo),
          poNo: normalizeOptionalText(input.poNo),
          description: normalizeOptionalText(input.description),
          originalAmount,
          paidAmount: new Prisma.Decimal(0),
          issueDate,
          dueDate,
          status: DebtStatus.OPEN,
          collectionStatus: CollectionStatus.NEW,
          nextFollowUpAt: input.nextFollowUpAt ? new Date(String(input.nextFollowUpAt)) : null,
          followUpNote: normalizeOptionalText(input.followUpNote),
          salesChannel: input.salesChannel,
          createdById: userId,
          ...(items.length > 0 ? { items: { create: items } } : {}),
        },
        include: { party: true },
      });
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
    const data = buildDebtCollectionData(input);
    const debt = await this.prisma.$transaction(async (tx) => {
      await this.assertAssignee(organizationId, input.assignedToId, tx);
      return tx.debt.update({
        where: { id, organizationId },
        data,
        include: { party: true, assignedTo: { select: { id: true, name: true, email: true } } },
      });
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
    requireOrganizationId(organizationId);
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

  private async assertAssignee(
    organizationId: string,
    userId: string | null | undefined,
    db: Prisma.TransactionClient,
  ) {
    const id = normalizeOptionalText(userId);
    if (id && !(await this.members.isActive(organizationId, id, db)))
      throw badRequest('debts.ASSIGNEE_NOT_FOUND');
  }

  private async nextDebtCode(organizationId: string, db: Prisma.TransactionClient) {
    const now = new Date();
    const prefix = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await db.debt.count({
      where: { organizationId, code: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
}
