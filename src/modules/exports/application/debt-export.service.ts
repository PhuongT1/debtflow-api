import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '@common/constants/pagination.constants.js';
import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import type { DebtFilters } from '@modules/debts/public/debt-filters.types.js';
import type { DebtExportPort } from './debt-export.port.js';

export class DebtExportService {
  constructor(private readonly exporter: DebtExportPort) {}

  build(organizationId: string, query: DebtFilters, criteria?: ListQueryOptions) {
    requireOrganizationId(organizationId);
    return this.exporter.build(
      organizationId,
      { ...query, page: DEFAULT_PAGE, pageSize: MAX_PAGE_SIZE },
      criteria,
    );
  }
}
