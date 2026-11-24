import { buildDebtCollectionData } from './debt-collection.mapper.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { ApplicationError } from '@common/errors/application-error.js';
import { AuditAction } from '@common/events/audit.types.js';
import type { PublishAudit } from '@common/events/audit-publisher.port.js';
import { scalarSnapshot } from '@common/events/audit-snapshot.js';
import type { DebtMoneyMath } from '@common/utils/decimal-amount.types.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import type { DebtsRepository, DebtWriteStore } from './repositories/debts.repository.js';
import type { CreateDebtInput, UpdateDebtCollectionInput } from './debt-inputs.types.js';
import type { DebtLineItemService } from './debt-line-item.service.js';
import type { DebtFilters } from '../public/debt-filters.types.js';

export class DebtsService {
  constructor(
    private readonly repository: DebtsRepository,
    private readonly debtLineItems: DebtLineItemService,
    private readonly publishAudit: PublishAudit,
    private readonly money: DebtMoneyMath,
  ) {}

  async list(organizationId: string, query: DebtFilters, listQuery?: ListQueryOptions) {
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

  async create(input: CreateDebtInput, organizationId: string, userId: string) {
    requireOrganizationId(organizationId);
    const issueDate = new Date(input.issueDate);
    const dueDate = new Date(input.dueDate);
    const originalAmount = this.money.parseMoney(input.originalAmount);
    if (!originalAmount) throw new ApplicationError('invalid', 'debts.INVALID_ORIGINAL_AMOUNT');

    if (dueDate < issueDate) {
      throw new ApplicationError('invalid', 'debts.DUE_DATE_BEFORE_ISSUE');
    }

    const debt = await this.repository.inTransaction(async (store) => {
      if (!(await store.hasActiveParty(organizationId, input.partyId)))
        throw new ApplicationError('not-found', 'parties.PARTY_NOT_FOUND');
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
        paidAmount: this.money.zero(),
        issueDate,
        dueDate,
        status: 'OPEN',
        collectionStatus: 'NEW',
        nextFollowUpAt: input.nextFollowUpAt ? new Date(String(input.nextFollowUpAt)) : null,
        followUpNote: normalizeOptionalText(input.followUpNote),
        salesChannel: input.salesChannel,
        createdById: userId,
        ...(items.length > 0 ? { items } : {}),
      });
    });

    this.publishAudit({
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
    input: UpdateDebtCollectionInput,
    organizationId: string,
    actorId?: string,
  ) {
    const before = await this.detail(id, organizationId);
    const data = buildDebtCollectionData(input);
    const debt = await this.repository.inTransaction(async (store) => {
      await this.assertAssignee(organizationId, input.assignedToId, store);
      return store.updateCollection(organizationId, id, data);
    });

    this.publishAudit({
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
      if (debt.paymentAllocations.length > 0)
        throw new ApplicationError('invalid', 'debts.CANNOT_CANCEL_PAID_DEBT');
      const cancelled = await store.cancel(organizationId, id);
      return { debt, cancelled };
    });

    this.publishAudit({
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
      throw new ApplicationError('invalid', 'debts.ASSIGNEE_NOT_FOUND');
  }

  private async nextDebtCode(organizationId: string, store: DebtWriteStore) {
    const now = new Date();
    const prefix = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return store.nextCode(organizationId, prefix);
  }
}
