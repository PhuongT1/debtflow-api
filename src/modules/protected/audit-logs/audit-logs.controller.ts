import { Controller, Get, Query } from '@nestjs/common';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { Roles } from '@auth/roles.decorator';
import { OrganizationRole } from '@generated/prisma';
import { AuditLogsService } from './audit-logs.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ProtectedApi()
@Roles(OrganizationRole.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  list(@Query() query: QueryAuditLogsDto) {
    return this.auditLogsService.list(query);
  }
}
