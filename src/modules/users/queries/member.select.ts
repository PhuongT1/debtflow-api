import type { Prisma } from '@generated/prisma';

export const MEMBER_INCLUDE = {
  user: {
    select: { id: true, name: true, email: true, phone: true, status: true, systemRole: true },
  },
} satisfies Prisma.OrganizationMembershipInclude;
