import type { DashboardPeriod } from '../dashboard-period.types.js';

export interface DashboardRepository<Summary, ActionCenter> {
  summary(period: DashboardPeriod, organizationId: string): Promise<Summary>;
  actionCenter(period: DashboardPeriod, organizationId: string): Promise<ActionCenter>;
}
