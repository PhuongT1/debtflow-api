import type { ListQueryResult } from '@common/query/index.js';
import type { QueryDebtsDto } from '@modules/debts/public/debts.js';
import type { AgingReportResponseDto } from '../dto/aging-report-response.dto.js';
export abstract class ReportsRepository {
  abstract aging(
    query: QueryDebtsDto,
    organizationId: string,
    listQuery?: ListQueryResult,
  ): Promise<AgingReportResponseDto>;
}
