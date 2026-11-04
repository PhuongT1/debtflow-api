import { HttpStatus } from '@nestjs/common';
import { ApiEnvelope } from '@common/http/api-envelope.decorator.js';
import { PaymentResponseDto, PaymentReversalResponseDto } from '../dto/payment-response.dto.js';
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query/index.js';
import { PAYMENT_LIST_QUERY } from '../queries/payments.list-query.js';
import { CurrentUser } from '@auth/decorators/current-user.decorator.js';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import type { JwtAuthPayload } from '@auth/types/auth-context.types.js';
import { Roles } from '@auth/decorators/roles.decorator.js';
import { OrganizationRole } from '@generated/prisma/client.js';
import { PaymentsService } from '../services/payments.service.js';
import { QueryPaymentsDto } from '../dto/query-payments.dto.js';
import { CreateAllocatedPaymentDto } from '../dto/create-allocated-payment.dto.js';
@ApiTags('Payments')
@ProtectedApi()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @ApiOperation({
    summary: 'List payments',
    description: 'Paginated vouchers with their allocations. Filter by partyId or debtId.',
  })
  @ApiListQuery(PAYMENT_LIST_QUERY)
  @Get()
  @ApiEnvelope(PaymentResponseDto, { paginated: true })
  list(
    @CurrentUser() u: JwtAuthPayload,
    @Query() q: QueryPaymentsDto,
    @ListQuery(PAYMENT_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.service.list(q, u.organizationId, listQuery);
  }

  @ApiOperation({
    summary: 'Record a payment and auto-allocate it',
    description:
      "Applies the amount to the party's OPEN/PARTIAL debts of the given type, oldest due date first. " +
      "Rejected when the amount exceeds the party's total remaining balance.",
  })
  @Post('auto-allocate')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(PaymentResponseDto, { status: HttpStatus.CREATED })
  create(@CurrentUser() u: JwtAuthPayload, @Body() b: CreateAllocatedPaymentDto) {
    return this.service.createAutoAllocated(b, u.organizationId, u.sub);
  }

  @ApiOperation({
    summary: 'Reverse (delete) a payment',
    description:
      'Deletes the voucher and subtracts its allocations from each debt, recomputing OPEN/PARTIAL/PAID.',
  })
  @Delete(':id')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(PaymentReversalResponseDto)
  remove(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string) {
    return this.service.remove(id, u.organizationId, u.sub);
  }
}
