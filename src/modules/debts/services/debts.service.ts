import { buildDebtCollectionData } from '../debt-collection.mapper.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { badRequest, notFound } from '@common/errors/app-errors.js';
import { AuditAction, emitAudit, scalarSnapshot } from '@common/events/audit-event.js';
import type { ListQueryResult } from '@common/query/index.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { CollectionStatus, DebtStatus, Prisma } from '@generated/prisma/client.js';
import { DebtsRepository, type DebtWriteStore } from '../repositories/debts.repository.js';
import { CreateDebtDto } from '../dto/create-debt.dto.js';
import { DebtLineItemService } from './debt-line-item.service.js';
import { QueryDebtsDto } from '../dto/query-debts.dto.js';
import { UpdateDebtCollectionDto } from '../dto/update-debt-collection.dto.js';

@Injectable()
export class DebtsService {
  constructor(
    private readonly repository: DebtsRepository,
    private readonly debtLineItems: DebtLineItemService,
    private readonly events: EventEmitter2,
  ) {}

  async list(organizationId: string, query: QueryDebtsDto, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    return this.repository.list(organizationId, query, listQuery);
  }

  async detail(id: string, organizationId: string) {
    requireOrganizationId(organizationId);
    const debt = await this.repository.detail(id, organizationId);

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

    const debt = await this.repository.inTransaction(async (store) => {
      if (!(await store.hasActiveParty(organizationId, input.partyId)))
        throw notFound('parties.PARTY_NOT_FOUND');
      await this.assertAssignee(organizationId, input.assignedToId, store);
      const productIds = (input.items ?? []).flatMap((item) =>
        item.productId ? [item.productId] : [],
      );
      const products = productIds.length ? await store.products(organizationId, productIds) : [];
      const items = await this.debtLineItems.prepare(input.items, originalAmount, products);
      return store.create({
        organizationId,
        code: await this.nextDebtCode(organizationId, store),
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
        ...(items.length > 0 ? { items } : {}),
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
    const debt = await this.repository.inTransaction(async (store) => {
      await this.assertAssignee(organizationId, input.assignedToId, store);
      return store.updateCollection(organizationId, id, data);
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
    const { debt, cancelled } = await this.repository.inTransaction(async (store) => {
      const debt = await store.findForCancellation(organizationId, id);
      if (debt.paymentAllocations.length > 0) throw badRequest('debts.CANNOT_CANCEL_PAID_DEBT');
      const cancelled = await store.cancel(organizationId, id);
      return { debt, cancelled };
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
    store: DebtWriteStore,
  ) {
    const id = normalizeOptionalText(userId);
    if (id && !(await store.hasActiveMember(organizationId, id)))
      throw badRequest('debts.ASSIGNEE_NOT_FOUND');
  }

  private async nextDebtCode(organizationId: string, store: DebtWriteStore) {
    const now = new Date();
    const prefix = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return store.nextCode(organizationId, prefix);
  }
}
