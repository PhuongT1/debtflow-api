import {
  OrganizationMembershipStatus,
  OrganizationStatus,
} from '@generated/prisma/client.js';
import { PrismaService } from '@database/prisma.service.js';
import { Injectable } from '@nestjs/common';
import { AUTH_USER_SELECT, MEMBERSHIP_CONTEXT_SELECT } from '../auth.select.js';
import { AuthRepository } from '../repositories/auth.repository.js';

@Injectable()
export class PrismaAuthRepository extends AuthRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  findForLogin(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });
  }
  findUser(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: AUTH_USER_SELECT });
  }
  getUser(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: AUTH_USER_SELECT });
  }
  memberships(userId: string) {
    return this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      select: MEMBERSHIP_CONTEXT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }
  async activeMembership(userId: string, organizationId?: string, membershipId?: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
        ...(organizationId ? { organizationId } : {}),
        ...(membershipId ? { id: membershipId } : {}),
      },
      select: MEMBERSHIP_CONTEXT_SELECT,
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
    return memberships[0] ?? null;
  }
}
