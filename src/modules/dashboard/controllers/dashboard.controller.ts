import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import type { JwtAuthPayload } from '@auth/types/auth-context.types';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator';
import { DashboardService } from '../services/dashboard.service';
import { DashboardQueryDto } from '../dto/query-dashboard.dto';

@ApiTags('Dashboard')
@ProtectedApi()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({
    summary: 'Get dashboard summary',
    description:
      'Receivable and payable totals, overdue count, action center (follow-ups and due soon), recent payments and the nearest unsettled debts.',
  })
  @Get()
  get(@CurrentUser() user: JwtAuthPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.get(query, user.organizationId);
  }
}
