import { getDashboardPeriod } from '../dashboard.query.js';
import { Injectable } from '@nestjs/common';
import type { DashboardQueryDto } from '../dto/query-dashboard.dto.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { DashboardRepository } from '../repositories/dashboard.repository.js';
import { DashboardActionCenterService } from './dashboard-action-center.service.js';
@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly actionCenter: DashboardActionCenterService,
  ) {}
  async get(query: DashboardQueryDto, organizationId: string) {
    requireOrganizationId(organizationId);
    getDashboardPeriod(query);
    const actionCenter = await this.actionCenter.get(query, organizationId);
    const summary = await this.repository.summary(query, organizationId);
    return { ...summary, actionCenter };
  }
}
