/**
 * Exposes audit-log listing HTTP endpoints.
 * Delegates to AuditLogsService for authorized tenant-scoped reads.
 */
import { ApiListQuery } from '@common/swagger/decorators/api-list-query.decorator.js';
import { API_ROUTES } from '@common/constants/api-routes.constants.js';
import { API_TAGS } from '@common/constants/api-tags.constants.js';
import { ApiEnvelope } from '@common/swagger/decorators/api-envelope.decorator.js';
import { AuditLogResponseDto } from './dto/audit-log-response.dto.js';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator.js';
import type { JwtAuthPayload } from '@auth/types/auth-context.types.js';
import { ListQuery, type ListQueryResult } from '@common/query/index.js';
import { AUDIT_LOG_LIST_QUERY } from './audit-logs.list-query.js';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import { Roles } from '@auth/decorators/roles.decorator.js';
import { OrganizationRole } from '@generated/prisma/client.js';
import { AuditLogsService } from './audit-logs.service.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';

@ApiTags(API_TAGS.AUDIT_LOGS)
@ProtectedApi()
@Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
@Controller(API_ROUTES.AUDIT_LOGS.PREFIX)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @ApiOperation({ summary: 'List audit log entries of the current organization' })
  @ApiListQuery(AUDIT_LOG_LIST_QUERY)
  @Get()
  @ApiEnvelope(AuditLogResponseDto, { paginated: true })
  list(
    @CurrentUser() user: JwtAuthPayload,
    @Query() query: QueryAuditLogsDto,
    @ListQuery(AUDIT_LOG_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.auditLogsService.list(user.organizationId, query, listQuery);
  }
}
