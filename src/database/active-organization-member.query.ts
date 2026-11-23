import {
  OrganizationMembershipStatus,
  OrganizationStatus,
  UserStatus,
} from '@generated/prisma/client.js';
import type { Prisma } from '@generated/prisma/client.js';

/** Use the caller's client so a membership check can participate in its write transaction. */
export async function hasActiveOrganizationMember(
  db: Pick<Prisma.TransactionClient, 'organizationMembership'>,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const member = await db.organizationMembership.findFirst({
    where: {
      organizationId,
      userId,
      status: OrganizationMembershipStatus.ACTIVE,
      user: { status: UserStatus.ACTIVE },
      organization: { status: OrganizationStatus.ACTIVE },
    },
    select: { id: true },
  });
  return Boolean(member);
}
