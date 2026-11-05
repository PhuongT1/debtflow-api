import type { DashboardQueryDto } from '../dto/query-dashboard.dto.js';
import type { DashboardSummary, DashboardActionCenter } from '../dashboard-read.types.js';
export abstract class DashboardRepository {
  abstract summary(query: DashboardQueryDto, organizationId: string): Promise<DashboardSummary>;
  abstract actionCenter(
    query: DashboardQueryDto | undefined,
    organizationId: string,
  ): Promise<DashboardActionCenter>;
}
