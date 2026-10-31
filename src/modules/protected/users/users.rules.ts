import {
  OrganizationMembershipStatus,
  OrganizationRole,
  UserStatus,
  type SystemRole,
} from '@generated/prisma';
import { badRequest, forbidden } from '@common/errors/app-errors';
import type { MemberDto } from './dto/user-response.dto';

export type Actor = { userId: string; role: OrganizationRole };
export type Target = { userId: string; role: OrganizationRole };
export type AccessChange = { role?: OrganizationRole; suspend?: boolean };

/**
 * Access rules for managing members (pure, covered by unit tests):
 * - nobody changes their own role or suspends themselves (no accidental lock-out);
 * - touching an OWNER, or granting OWNER, is reserved to OWNERs.
 * Together they guarantee an organization always keeps an active OWNER.
 */
export function assertCanChangeAccess(actor: Actor, target: Target, change: AccessChange) {
  const changesRole = change.role !== undefined && change.role !== target.role;

  if (actor.userId === target.userId && (changesRole || change.suspend)) {
    throw forbidden('users.CANNOT_CHANGE_OWN_ACCESS');
  }

  const involvesOwner =
    target.role === OrganizationRole.OWNER || change.role === OrganizationRole.OWNER;

  if (involvesOwner && actor.role !== OrganizationRole.OWNER) {
    throw forbidden('users.OWNER_ONLY');
  }
}

/** Creating a member with a role is granting that role. */
export function assertCanGrantRole(actor: Actor, role: OrganizationRole) {
  if (role === OrganizationRole.OWNER && actor.role !== OrganizationRole.OWNER) {
    throw forbidden('users.OWNER_ONLY');
  }
}

/**
 * `name` and `phone` live on the global account. They can only be edited by the user themselves, or
 * by an admin when the account belongs to no other organization.
 */
export function assertCanEditProfile(actor: Actor, targetUserId: string, membershipCount: number) {
  if (actor.userId !== targetUserId && membershipCount > 1) {
    throw forbidden('users.SHARED_ACCOUNT');
  }
}

export function assertCanSuspend(status: OrganizationMembershipStatus) {
  if (status === OrganizationMembershipStatus.SUSPENDED) {
    throw badRequest('users.ALREADY_SUSPENDED');
  }
}

export function assertCanReactivate(status: OrganizationMembershipStatus) {
  if (status === OrganizationMembershipStatus.ACTIVE) throw badRequest('users.ALREADY_ACTIVE');
}

type MembershipWithUser = {
  id: string;
  role: OrganizationRole;
  status: OrganizationMembershipStatus;
  invitedAt: Date | null;
  joinedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: UserStatus;
    systemRole: SystemRole;
  };
};

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
