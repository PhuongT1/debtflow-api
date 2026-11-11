import { Injectable } from '@nestjs/common';
import type { DashboardQueryDto } from '../dto/query-dashboard.dto.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import { DashboardRepository } from '../repositories/dashboard.repository.js';
@Injectable()
export class DashboardActionCenterService {
  constructor(private readonly repository: DashboardRepository) {}
  get(query: DashboardQueryDto | undefined, organizationId: string) {
    requireOrganizationId(organizationId);
    return this.repository.actionCenter(query, organizationId);
  }
}
