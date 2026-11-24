import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { getDashboardPeriod } from './queries/dashboard-period.query.js';
import type { DashboardPeriodInput } from './dashboard-period.types.js';
import type { DashboardRepository } from './repositories/dashboard.repository.js';

export class DashboardService<Summary extends object = object, ActionCenter = object> {
  constructor(private readonly repository: DashboardRepository<Summary, ActionCenter>) {}

  async get(query: DashboardPeriodInput, organizationId: string) {
    requireOrganizationId(organizationId);
    const period = getDashboardPeriod(query);
    const actionCenter = await this.repository.actionCenter(period, organizationId);
    const summary = await this.repository.summary(period, organizationId);
    return { ...summary, actionCenter };
  }
}
