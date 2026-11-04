import { ApiEnvelope, ApiErrorEnvelopes } from '#common/http/api-envelope.decorator.js';
import { DashboardResponseDto } from '../dto/dashboard-response.dto.js';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '#auth/decorators/current-user.decorator.js';
import type { JwtAuthPayload } from '#auth/types/auth-context.types.js';
import { ProtectedApi } from '#auth/decorators/auth-api.decorator.js';
import { DashboardService } from '../services/dashboard.service.js';
import { DashboardQueryDto } from '../dto/query-dashboard.dto.js';

@ApiTags('Dashboard')
@ProtectedApi()
@ApiErrorEnvelopes({ badRequest: 'Invalid input or business rule violation.' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({
    summary: 'Get dashboard summary',
    description:
      'Receivable and payable totals, overdue count, action center (follow-ups and due soon), recent payments and the nearest unsettled debts.',
  })
  @Get()
  @ApiEnvelope(DashboardResponseDto)
  get(@CurrentUser() user: JwtAuthPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.get(query, user.organizationId);
  }
}
