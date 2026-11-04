import { HttpStatus } from '@nestjs/common';
import { ApiEnvelope, ApiErrorEnvelopes } from '@common/http/api-envelope.decorator.js';
import { DebtRecordDto } from '../dto/debt-record.dto.js';
import {
  DebtWithPartyDto,
  DebtCollectionResponseDto,
  DebtListResponseDto,
  DebtDetailResponseDto,
} from '../dto/debt-response.dto.js';
import { PaymentResponseDto } from '@modules/payments/public/payments.js';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query/index.js';
import { DEBT_LIST_QUERY } from '../queries/debts.list-query.js';
import { CurrentUser } from '@auth/decorators/current-user.decorator.js';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import type { JwtAuthPayload } from '@auth/types/auth-context.types.js';
import { Roles } from '@auth/decorators/roles.decorator.js';
import { OrganizationRole } from '@generated/prisma/client.js';
import { DebtsService } from '../services/debts.service.js';
import { PaymentsService } from '@modules/payments/public/payments.js';
import { CreateDebtDto } from '../dto/create-debt.dto.js';
import { QueryDebtsDto } from '../dto/query-debts.dto.js';
import { UpdateDebtCollectionDto } from '../dto/update-debt-collection.dto.js';
import { CreatePaymentDto } from '@modules/payments/public/payments.js';
@ApiTags('Debts')
@ProtectedApi()
@ApiErrorEnvelopes({
  badRequest: 'Invalid input or business rule violation.',
  notFound: 'The tenant-owned resource was not found.',
  conflict: 'Resource conflict.',
})
@Controller('debts')
export class DebtsController {
  constructor(
    private readonly debts: DebtsService,
    private readonly payments: PaymentsService,
  ) {}

  @ApiOperation({
    summary: 'List debts',
    description:
      'Paginated list with filters for type, status, collection status, party, product, aging bucket, due date range and follow-up.',
  })
  @ApiListQuery(DEBT_LIST_QUERY)
  @Get()
  @ApiEnvelope(DebtListResponseDto, { paginated: true })
  list(
    @CurrentUser() u: JwtAuthPayload,
    @Query() q: QueryDebtsDto,
    @ListQuery(DEBT_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.debts.list(u.organizationId, q, listQuery);
  }

  @ApiOperation({
    summary: 'Create a debt',
    description:
      'Creates a receivable or payable with an auto-generated code (CN-YYYYMM-NNNN). dueDate must not be before issueDate.',
  })
  @Post()
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(DebtWithPartyDto, { status: HttpStatus.CREATED })
  create(@CurrentUser() u: JwtAuthPayload, @Body() b: CreateDebtDto) {
    return this.debts.create(b, u.organizationId, u.sub);
  }

  @ApiOperation({
    summary: 'Get debt detail',
    description: 'Includes party, assignee, line items and the payments applied to the debt.',
  })
  @Get(':id')
  @ApiEnvelope(DebtDetailResponseDto)
  detail(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string) {
    return this.debts.detail(id, u.organizationId);
  }

  @ApiOperation({
    summary: 'Update collection information',
    description:
      'Updates the assignee, collection status, follow-up schedule and reference numbers. Amounts and status are not editable here.',
  })
  @Patch(':id')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(DebtCollectionResponseDto)
  update(
    @CurrentUser() u: JwtAuthPayload,
    @Param('id') id: string,
    @Body() b: UpdateDebtCollectionDto,
  ) {
    return this.debts.updateCollection(id, b, u.organizationId, u.sub);
  }
  @ApiOperation({
    summary: 'Cancel a debt',
    description: 'Sets status to CANCELLED. Rejected when the debt already has payments.',
  })
  @Delete(':id')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(DebtRecordDto)
  cancel(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string) {
    return this.debts.cancel(id, u.organizationId, u.sub);
  }

  @ApiOperation({
    summary: 'Record a payment against one debt',
    description:
      'Rejected when the debt is PAID or CANCELLED, or when the amount exceeds the remaining balance.',
  })
  @Post(':id/payments')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(PaymentResponseDto, { status: HttpStatus.CREATED })
  payment(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string, @Body() b: CreatePaymentDto) {
    return this.payments.create(id, b, u.organizationId, u.sub);
  }
}
