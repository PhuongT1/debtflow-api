import type { Prisma } from '#generated/prisma/client.js';

export const AUTH_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  systemRole: true,
  status: true,
} satisfies Prisma.UserSelect;

export const AUTH_ORGANIZATION_SELECT = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  status: true,
} satisfies Prisma.OrganizationSelect;

export const MEMBERSHIP_CONTEXT_SELECT = {
  id: true,
  organizationId: true,
  role: true,
  organization: { select: AUTH_ORGANIZATION_SELECT },
} satisfies Prisma.OrganizationMembershipSelect;
