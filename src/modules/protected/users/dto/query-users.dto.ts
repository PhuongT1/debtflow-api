import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { OrganizationRole, UserStatus } from '@generated/prisma';

export class QueryUsersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
