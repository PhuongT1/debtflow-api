import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@auth/current-user.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { ReportsService } from './reports.service';
import { DEBT_LIST_QUERY } from '@modules/protected/debts/debts.list-query';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query';

@ApiTags('Reports')
@ProtectedApi()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({
    summary: 'Aging report',
    description:
      'Remaining balance grouped into buckets: not due, 1-7, 8-30, 31-60 and 60+ days overdue. Accepts the same query filters as GET /debts.',
  })
  @ApiListQuery(DEBT_LIST_QUERY)
  @Get('aging')
  aging(
    @CurrentUser() user: JwtAuthPayload,
    @Query() query: Record<string, string | undefined>,
    @ListQuery(DEBT_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.reportsService.aging(query, user.organizationId, listQuery);
  }
}
