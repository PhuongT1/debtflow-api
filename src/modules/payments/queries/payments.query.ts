import { applyListQuery, type ListQueryResult } from '#common/query/index.js';
import { requireOrganizationId } from '#common/validation/require-organization-id.js';
import type { Prisma } from '#generated/prisma/client.js';
import type { QueryPaymentsDto } from '../dto/query-payments.dto.js';

export function buildPaymentsQuery(
  organizationId: string,
  query: QueryPaymentsDto,
  listQuery?: ListQueryResult,
) {
  requireOrganizationId(organizationId);
  const where: Prisma.PaymentWhereInput = { organizationId };
  if (query.debtId) where.allocations = { some: { debtId: query.debtId } };
  if (query.partyId) where.partyId = query.partyId;
  return applyListQuery<Prisma.PaymentWhereInput, Prisma.PaymentOrderByWithRelationInput[]>(
    listQuery,
    { where, orderBy: [{ paidAt: 'desc' }, { id: 'asc' }] },
  );
}
