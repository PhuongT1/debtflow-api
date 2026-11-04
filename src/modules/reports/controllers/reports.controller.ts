import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '#auth/decorators/current-user.decorator.js';
import type { JwtAuthPayload } from '#auth/types/auth-context.types.js';
import { ProtectedApi } from '#auth/decorators/auth-api.decorator.js';
import { ReportsService } from '../services/reports.service.js';
import { DEBT_LIST_QUERY } from '#modules/debts/public/debts.js';
import { ApiListQuery, ListQuery, type ListQueryResult } from '#common/query/index.js';
import { ApiEnvelope, ApiErrorEnvelopes } from '#common/http/api-envelope.decorator.js';
import { QueryDebtsDto } from '#modules/debts/public/debts.js';
import { AgingReportResponseDto } from '../dto/aging-report-response.dto.js';

@ApiTags('Reports')
@ProtectedApi()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({
    summary: 'Aging report',
    description:
      'Remaining balance across all matching open/partial debts, grouped by whole elapsed 24-hour days: ' +
      'less than 1, 1-7, 8-30, 31-60 and 61+ days overdue. Accepts the same query filters as GET /debts. ' +
      'page, pageSize and sort are accepted for compatibility but do not limit or order the totals.',
  })
  @ApiEnvelope(AgingReportResponseDto)
  @ApiErrorEnvelopes({ badRequest: 'Invalid debt filters or query parameters.' })
  @ApiListQuery(DEBT_LIST_QUERY)
  @Get('aging')
  aging(
    @CurrentUser() user: JwtAuthPayload,
    @Query() query: QueryDebtsDto,
    @ListQuery(DEBT_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.reportsService.aging(query, user.organizationId, listQuery);
  }
}
