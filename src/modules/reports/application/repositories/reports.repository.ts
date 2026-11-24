import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { DebtFilters } from '@modules/debts/public/debt-filters.types.js';
import type { AgingReport } from '../aging-report.types.js';
export abstract class ReportsRepository {
  abstract aging(
    query: DebtFilters,
    organizationId: string,
    listQuery?: ListQueryOptions,
  ): Promise<AgingReport>;
}
