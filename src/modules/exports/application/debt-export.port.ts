import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { DebtFilters } from '@modules/debts/public/debt-filters.types.js';

export interface DebtExportPort {
  build(
    organizationId: string,
    query: DebtFilters,
    criteria?: ListQueryOptions,
  ): Promise<Uint8Array>;
}
