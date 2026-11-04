import { applyListQuery, type ListQueryResult } from '#common/query/index.js';
import { requireOrganizationId } from '#common/validation/require-organization-id.js';
import { DebtStatus, Prisma } from '#generated/prisma/client.js';
import type { QueryDebtsDto } from '../dto/query-debts.dto.js';
import { buildDebtDateFilters } from './debt-date-filters.js';

/** Shared, tenant-scoped read contract for debt lists and reports. */
export function buildDebtQuery(
  organizationId: string,
  query: QueryDebtsDto,
  listQuery?: ListQueryResult,
  now = new Date(),
) {
  requireOrganizationId(organizationId);
  const where = buildFieldFilters(organizationId, query);
  const conditions = buildDebtDateFilters(query, now);

  if (query.aging || query.overdue === 'true' || query.outstanding === 'true') {
    conditions.push({ status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] } });
  }
  if (query.outstanding === 'false') conditions.push({ status: DebtStatus.PAID });
  if (conditions.length) where.AND = conditions;

  return applyListQuery<Prisma.DebtWhereInput, Prisma.DebtOrderByWithRelationInput[]>(listQuery, {
    where,
    orderBy:
      query.overdue === 'true'
        ? [{ dueDate: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'asc' }],
  });
}

function buildFieldFilters(organizationId: string, query: QueryDebtsDto): Prisma.DebtWhereInput {
  const where: Prisma.DebtWhereInput = { organizationId };
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.collectionStatus) where.collectionStatus = query.collectionStatus;
  if (query.partyId) where.partyId = query.partyId;
  if (query.salesChannel) where.salesChannel = query.salesChannel;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.provinceCode) where.party = { provinceCode: query.provinceCode };

  if (query.categoryId || query.brandId || query.productId) {
    const product: Prisma.ProductWhereInput = {};
    if (query.categoryId) product.categoryId = query.categoryId;
    if (query.brandId) product.brandId = query.brandId;
    if (query.productId) product.id = query.productId;
    where.items = { some: { product } };
  }

  if (query.q) {
    const text: Prisma.StringFilter = { contains: query.q, mode: 'insensitive' };
    where.OR = [
      { code: text },
      { title: text },
      { invoiceNo: text },
      { orderNo: text },
      { contractNo: text },
      { poNo: text },
      { party: { name: text } },
    ];
  }
  return where;
}
