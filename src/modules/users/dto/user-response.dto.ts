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

export class UserOptionDto extends UserSummaryDto {
  status!: UserStatus;
  role!: OrganizationRole;
}

export class MemberDto extends UserSummaryDto {
  /** Id of the membership of this user in the current organization. */
  membershipId!: string;
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
