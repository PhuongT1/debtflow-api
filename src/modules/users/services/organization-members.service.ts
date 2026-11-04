import { Injectable } from '@nestjs/common';
import { PrismaService } from '#database/prisma.service.js';
import type { Prisma } from '#generated/prisma/client.js';
import { requireOrganizationId } from '#common/validation/require-organization-id.js';

/** Shared membership lookup; callers own the error semantics of their operation. */
@Injectable()
export class OrganizationMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async isActive(
    organizationId: string,
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    requireOrganizationId(organizationId);
    return Boolean(
      await db.organizationMembership.findFirst({
        where: {
          organizationId,
          userId,
          status: 'ACTIVE',
          user: { status: 'ACTIVE' },
          organization: { status: 'ACTIVE' },
        },
        select: { id: true },
      }),
    );
  }
}
