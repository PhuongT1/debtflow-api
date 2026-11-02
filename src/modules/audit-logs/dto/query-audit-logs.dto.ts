import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';

export class QueryAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
