import type { AuditEntry } from '@common/events/audit-event.js';
import type { ListQueryResult } from '@common/query/index.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { QueryAuditLogsDto } from '../dto/query-audit-logs.dto.js';
import type { AuditLogResponseDto } from '../dto/audit-log-response.dto.js';
export abstract class AuditLogsRepository {
  abstract list(
    organizationId: string,
    query: QueryAuditLogsDto,
    listQuery?: ListQueryResult,
  ): Promise<PaginatedResult<AuditLogResponseDto>>;
  abstract record(entry: AuditEntry): Promise<void>;
}
