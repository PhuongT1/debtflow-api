import type { MembershipWithUser } from './member.types.js';

/** One consistent member shape for list, create, update, suspend and reactivate. */
export function toOrganizationMember({ user, ...membership }: MembershipWithUser) {
  const effective =
    user.status === 'ACTIVE' && membership.status === 'ACTIVE'
      ? ('ACTIVE' as const)
      : ('INACTIVE' as const);

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
