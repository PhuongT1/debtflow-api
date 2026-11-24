import { ApplicationError } from '@common/errors/application-error.js';
import type {
  AccessChange,
  MemberIdentity,
  MembershipStatus,
  OrganizationRole,
} from './member-access.types.js';

/**
 * Access rules for managing members (pure, covered by unit tests):
 * - nobody changes their own role or suspends themselves (no accidental lock-out);
 * - touching an OWNER, or granting OWNER, is reserved to OWNERs.
 * Together they guarantee an organization always keeps an active OWNER.
 */
export function assertCanChangeAccess(
  actor: MemberIdentity,
  target: MemberIdentity,
  change: AccessChange,
) {
  const changesRole = change.role !== undefined && change.role !== target.role;

  if (actor.userId === target.userId && (changesRole || change.suspend)) {
    throw new ApplicationError('forbidden', 'users.CANNOT_CHANGE_OWN_ACCESS');
  }

  const involvesOwner = target.role === 'OWNER' || change.role === 'OWNER';

  if (involvesOwner && actor.role !== 'OWNER') {
    throw new ApplicationError('forbidden', 'users.OWNER_ONLY');
  }
}

/** Creating a member with a role is granting that role. */
export function assertCanGrantRole(actor: MemberIdentity, role: OrganizationRole) {
  if (role === 'OWNER' && actor.role !== 'OWNER') {
    throw new ApplicationError('forbidden', 'users.OWNER_ONLY');
  }
}

/**
 * `name` and `phone` live on the global account. They can only be edited by the user themselves, or
 * by an admin when the account belongs to no other organization.
 */
export function assertCanEditProfile(
  actor: MemberIdentity,
  targetUserId: string,
  membershipCount: number,
) {
  if (actor.userId !== targetUserId && membershipCount > 1) {
    throw new ApplicationError('forbidden', 'users.SHARED_ACCOUNT');
  }
}

export function assertCanSuspend(status: MembershipStatus) {
  if (status === 'SUSPENDED') {
    throw new ApplicationError('invalid', 'users.ALREADY_SUSPENDED');
  }
}

export function assertCanReactivate(status: MembershipStatus) {
  if (status === 'ACTIVE') throw new ApplicationError('invalid', 'users.ALREADY_ACTIVE');
}
