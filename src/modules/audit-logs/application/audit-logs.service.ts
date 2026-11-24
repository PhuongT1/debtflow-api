import type { AuditLogListInput } from './audit-log-read.types.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { AuditLogsRepository } from './repositories/audit-logs.repository.js';
export class AuditLogsService {
  constructor(private readonly repository: AuditLogsRepository) {}
  list(organizationId: string, query: AuditLogListInput, listQuery?: ListQueryOptions) {
    requireOrganizationId(organizationId);
    return this.repository.list(organizationId, query, listQuery);
  }
}
