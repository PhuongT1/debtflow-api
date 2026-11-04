import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '#common/dto/pagination-query.dto.js';
import { OrganizationMembershipStatus, OrganizationRole, UserStatus } from '#generated/prisma/client.js';

export class QueryUsersDto extends PaginationQueryDto {
  /** Search over name, email and phone (case-insensitive). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Only members with this role. */
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  /**
   * Effective status: `ACTIVE` = active membership of an active account, `INACTIVE` = anything else
   * (suspended or invited membership, or a disabled account).
   */
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** Exact membership status in this organization. */
  @IsOptional()
  @IsEnum(OrganizationMembershipStatus)
  membershipStatus?: OrganizationMembershipStatus;
}
