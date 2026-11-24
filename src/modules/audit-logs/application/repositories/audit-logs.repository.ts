import type { AuditLogListInput, AuditLogRecord } from '../audit-log-read.types.js';
import type { AuditEntry } from '@common/events/audit.types.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
export abstract class AuditLogsRepository {
  abstract list(
    organizationId: string,
    query: AuditLogListInput,
    listQuery?: ListQueryOptions,
  ): Promise<PaginatedResult<AuditLogRecord>>;
  abstract record(entry: AuditEntry): Promise<void>;
}
