import { applyListQuery, type ListQueryResult } from '#common/query/index.js';
import { OrganizationMembershipStatus, UserStatus, Prisma } from '#generated/prisma/client.js';
import type { QueryUsersDto } from '../dto/query-users.dto.js';

export function buildUsersQuery(
  organizationId: string,
  query: QueryUsersDto,
  listQuery?: ListQueryResult,
) {
  const conditions: Prisma.OrganizationMembershipWhereInput[] = [];

  if (query.membershipStatus) conditions.push({ status: query.membershipStatus });
  if (query.status) conditions.push(effectiveStatusWhere(query.status));
  if (query.q) {
    conditions.push({
      user: {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
          { phone: { contains: query.q, mode: 'insensitive' } },
        ],
      },
    });
  }

  const baseWhere: Prisma.OrganizationMembershipWhereInput = {
    organizationId,
    role: query.role,
  };
  if (conditions.length > 0) baseWhere.AND = conditions;
  return applyListQuery<
    Prisma.OrganizationMembershipWhereInput,
    Prisma.OrganizationMembershipOrderByWithRelationInput[]
  >(listQuery, { where: baseWhere, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
}

function effectiveStatusWhere(status: UserStatus): Prisma.OrganizationMembershipWhereInput {
  const active = {
    status: OrganizationMembershipStatus.ACTIVE,
    user: { status: UserStatus.ACTIVE },
  };

  return status === UserStatus.ACTIVE ? active : { NOT: active };
}
