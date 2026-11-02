import type { OrganizationMembership, OrganizationRole, Prisma } from '@generated/prisma';
import type { MEMBER_INCLUDE } from '../queries/member.select';

type MemberIdentity = Pick<OrganizationMembership, 'userId' | 'role'>;
export type Actor = MemberIdentity;
export type Target = MemberIdentity;
export type AccessChange = { role?: OrganizationRole; suspend?: boolean };
export type MembershipWithUser = Pick<
  Prisma.OrganizationMembershipGetPayload<{
    include: typeof MEMBER_INCLUDE;
  }>,
  'id' | 'role' | 'status' | 'invitedAt' | 'joinedAt' | 'createdAt' | 'user'
>;
