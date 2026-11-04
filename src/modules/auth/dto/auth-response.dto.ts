import {
  OrganizationKind,
  OrganizationRole,
  OrganizationStatus,
  SystemRole,
  UserStatus,
} from '#generated/prisma/client.js';
import { UserSummaryDto } from '#modules/users/public/users.js';

export class AuthUserResponseDto extends UserSummaryDto {
  systemRole!: SystemRole;
  status!: UserStatus;
}
export class AuthOrganizationDto {
  id!: string;
  name!: string;
  slug!: string;
  kind!: OrganizationKind;
  status!: OrganizationStatus;
}
export class AuthMembershipDto extends AuthOrganizationDto {
  membershipId!: string;
  role!: OrganizationRole;
}
export class SessionResponseDto {
  accessToken!: string;
  /** Unix timestamp in milliseconds. */
  accessTokenExpiresAt!: number;
  /** Remaining lifetime in seconds. */
  expiresIn!: number;
  refreshToken!: string;
  tokenType!: string;
  user!: AuthUserResponseDto;
  activeOrganization!: AuthMembershipDto;
}
export class CurrentUserResponseDto extends AuthUserResponseDto {
  organizations!: AuthMembershipDto[];
}
