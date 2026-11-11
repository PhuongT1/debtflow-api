import { Injectable } from '@nestjs/common';
import type { ListQueryResult } from '@common/query/index.js';
import type { QueryDebtsDto } from '@modules/debts/public/debts.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { ReportsRepository } from './repositories/reports.repository.js';
@Injectable()
export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}
  async aging(query: QueryDebtsDto, organizationId: string, listQuery?: ListQueryResult) {
    requireOrganizationId(organizationId);
    return this.repository.aging(query, organizationId, listQuery);
  }
}
