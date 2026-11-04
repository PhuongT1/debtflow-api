import type { Prisma } from '#generated/prisma/client.js';
import type { AUTH_USER_SELECT, MEMBERSHIP_CONTEXT_SELECT } from '../queries/auth.select.js';

export type AuthUser = Prisma.UserGetPayload<{ select: typeof AUTH_USER_SELECT }>;
export type MembershipContext = Prisma.OrganizationMembershipGetPayload<{
  select: typeof MEMBERSHIP_CONTEXT_SELECT;
}>;
