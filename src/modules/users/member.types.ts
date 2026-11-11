import type { OrganizationMembership, OrganizationRole, Prisma } from '@generated/prisma/client.js';
import type { MEMBER_INCLUDE } from './queries/member.select.js';

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

export type MemberOption = Pick<MembershipWithUser['user'], 'id' | 'name' | 'email' | 'status'> &
  Pick<MembershipWithUser, 'role'>;
