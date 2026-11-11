import { Injectable } from '@nestjs/common';
import type { ListQueryResult } from '@common/query/index.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import type { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';
import { AuditLogsRepository } from './repositories/audit-logs.repository.js';
@Injectable()
export class AuditLogsService {
  constructor(private readonly repository: AuditLogsRepository) {}
  list(organizationId: string, query: QueryAuditLogsDto, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    return this.repository.list(organizationId, query, listQuery);
  }
}
