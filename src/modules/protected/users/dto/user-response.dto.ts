import {
  OrganizationMembershipStatus,
  OrganizationRole,
  SystemRole,
  UserStatus,
} from '@generated/prisma';

export class UserSummaryDto {
  id!: string;
  name!: string;
  email!: string;
}

export class UserOptionDto {
  /** User id. Use it for `assignedToId`. */
  id!: string;
  name!: string;
  email!: string;
  status!: UserStatus;
  role!: OrganizationRole;
}

export class MemberDto {
  /** User id. This is the id used by every `/users/{id}` endpoint. */
  id!: string;
  /** Id of the membership of this user in the current organization. */
  membershipId!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  /** Effective status: ACTIVE only when both the account and the membership are active. */
  status!: UserStatus;
  /** Status of the account itself (global). */
  userStatus!: UserStatus;
  /** Status of the membership in this organization. */
  membershipStatus!: OrganizationMembershipStatus;
  role!: OrganizationRole;
  systemRole!: SystemRole;
  invitedAt!: Date | null;
  joinedAt!: Date | null;
  /** When the user was added to this organization. */
  createdAt!: Date;
}
