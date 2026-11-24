import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto.js';
import type { AuditLogListInput } from '../../application/audit-log-read.types.js';

export class QueryAuditLogsDto extends PaginationQueryDto implements AuditLogListInput {
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
