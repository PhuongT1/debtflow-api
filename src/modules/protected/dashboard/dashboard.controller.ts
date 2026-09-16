import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@auth/current-user.decorator'; import type { JwtAuthPayload } from '@auth/jwt-auth.guard'; import { ProtectedApi } from '@auth/auth-api.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/query-dashboard.dto';

@ProtectedApi()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  get(@CurrentUser() user: JwtAuthPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.get(query, user.organizationId);
  }
}
