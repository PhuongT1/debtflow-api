import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { ApiErrorEnvelopes } from '@common/http/api-envelope.decorator';
import type { Response } from 'express';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import type { JwtAuthPayload } from '@auth/types/auth-context.types';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator';
import { SkipApiResponse } from '@common/decorators/api-response.decorator';
import { DebtExportService } from '../services/debt-export.service';
import { QueryDebtsDto } from '@modules/debts/public/debts';
import { DEBT_LIST_QUERY } from '@modules/debts/public/debts';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query';

@ApiTags('Exports')
@ProtectedApi()
@SkipApiResponse()
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportService: DebtExportService) {}

  @ApiOperation({
    summary: 'Export debts to Excel',
    description:
      'Streams an .xlsx file (not wrapped in the JSON envelope). Accepts the same query filters as GET /debts, up to 1000 rows.',
  })
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiErrorEnvelopes({ badRequest: 'Invalid debt export filters or query parameters.' })
  @ApiListQuery(DEBT_LIST_QUERY)
  @Get('debts')
  async debts(
    @CurrentUser() user: JwtAuthPayload,
    @Query() query: QueryDebtsDto,
    @ListQuery(DEBT_LIST_QUERY) listQuery: ListQueryResult,
    @Res() response: Response,
  ) {
    const buffer = await this.exportService.build(user.organizationId, query, listQuery);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', 'attachment; filename="debtflow-debts.xlsx"');
    response.send(buffer);
  }
}
