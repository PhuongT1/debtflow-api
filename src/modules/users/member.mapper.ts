import { OrganizationMembershipStatus, UserStatus } from '@generated/prisma/client.js';
import type { MemberDto } from './dto/user-response.dto.js';
import type { MembershipWithUser } from './member.types.js';

/** One consistent member shape for list, create, update, suspend and reactivate. */
export function toMemberDto({ user, ...membership }: MembershipWithUser): MemberDto {
  const effective =
    user.status === UserStatus.ACTIVE && membership.status === OrganizationMembershipStatus.ACTIVE
      ? UserStatus.ACTIVE
      : UserStatus.INACTIVE;

  return {
    id: user.id,
    membershipId: membership.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: effective,
    userStatus: user.status,
    membershipStatus: membership.status,
    role: membership.role,
    systemRole: user.systemRole,
    invitedAt: membership.invitedAt,
    joinedAt: membership.joinedAt,
    createdAt: membership.createdAt,
  };
}
