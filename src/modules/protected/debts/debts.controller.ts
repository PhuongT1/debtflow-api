import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query';
import { DEBT_LIST_QUERY } from './debts.list-query';
import { CurrentUser } from '@auth/current-user.decorator';
import { ProtectedApi } from '@auth/auth-api.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { Roles } from '@auth/roles.decorator';
import { OrganizationRole } from '@generated/prisma';
import { DebtsService } from './debts.service';
import { PaymentsService } from '@modules/protected/payments/payments.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { QueryDebtsDto } from './dto/query-debts.dto';
import { UpdateDebtCollectionDto } from './dto/update-debt-collection.dto';
import { CreatePaymentDto } from '@modules/protected/payments/dto/create-payment.dto';
@ApiTags('Debts')
@ProtectedApi()
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
  create(@CurrentUser() u: JwtAuthPayload, @Body() b: CreateDebtDto) {
    return this.debts.create(b, u.organizationId, u.sub);
  }

  @ApiOperation({
    summary: 'Get debt detail',
    description: 'Includes party, assignee, line items and the payments applied to the debt.',
  })
  @Get(':id')
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
  payment(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string, @Body() b: CreatePaymentDto) {
    return this.payments.create(id, b, u.organizationId, u.sub);
  }
}
