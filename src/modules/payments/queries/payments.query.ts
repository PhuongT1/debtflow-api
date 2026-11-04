import { applyListQuery, type ListQueryResult } from '@common/query';
import { requireOrganizationId } from '@common/validation/require-organization-id';
import type { Prisma } from '@generated/prisma';
import type { QueryPaymentsDto } from '../dto/query-payments.dto';

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
