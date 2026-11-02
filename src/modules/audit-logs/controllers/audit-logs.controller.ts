import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import type { JwtAuthPayload } from '@auth/types/auth-context.types';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query';
import { AUDIT_LOG_LIST_QUERY } from '../queries/audit-logs.list-query';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator';
import { Roles } from '@auth/decorators/roles.decorator';
import { OrganizationRole } from '@generated/prisma';
import { AuditLogsService } from '../services/audit-logs.service';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';

@ApiTags('Audit logs')
@ProtectedApi()
@Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @ApiOperation({ summary: 'List audit log entries of the current organization' })
  @ApiListQuery(AUDIT_LOG_LIST_QUERY)
  @Get()
  list(
    @CurrentUser() user: JwtAuthPayload,
    @Query() query: QueryAuditLogsDto,
    @ListQuery(AUDIT_LOG_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.auditLogsService.list(user.organizationId, query, listQuery);
  }
}
