import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { DebtFilters } from '@modules/debts/public/debt-filters.types.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { ReportsRepository } from './repositories/reports.repository.js';
export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}
  async aging(query: DebtFilters, organizationId: string, listQuery?: ListQueryOptions) {
    requireOrganizationId(organizationId);
    return this.repository.aging(query, organizationId, listQuery);
  }
}
