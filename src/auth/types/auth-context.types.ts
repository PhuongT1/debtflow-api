import type { Request } from 'express';
import type { OrganizationRole, SystemRole } from '@generated/prisma';

export type JwtAuthPayload = {
  sub: string;
  email: string;
  systemRole: SystemRole;
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
  type: 'access';
};

export type RefreshTokenPayload = Pick<
  JwtAuthPayload,
  'sub' | 'organizationId' | 'membershipId' | 'role'
> & { type: 'refresh' };

export type AuthenticatedRequest = Request & { user?: JwtAuthPayload };
