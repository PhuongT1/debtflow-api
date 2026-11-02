import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import type { JwtAuthPayload } from '@auth/types/auth-context.types';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator';
import { ReportsService } from '../services/reports.service';
import { DEBT_LIST_QUERY } from '@modules/debts/public/debts';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query';
import { ApiEnvelope, ApiErrorEnvelopes } from '@common/http/api-envelope.decorator';
import { QueryDebtsDto } from '@modules/debts/public/debts';
import { AgingReportResponseDto } from '../dto/aging-report-response.dto';

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
