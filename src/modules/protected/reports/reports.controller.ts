import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@auth/current-user.decorator'; import type { JwtAuthPayload } from '@auth/jwt-auth.guard'; import { ProtectedApi } from '@auth/auth-api.decorator';
import { ReportsService } from './reports.service';

@ProtectedApi()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('aging')
  aging(@CurrentUser() user: JwtAuthPayload, @Query() query: Record<string, string | undefined>) {
    return this.reportsService.aging(query, user.organizationId);
  }
}
