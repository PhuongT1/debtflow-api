/**
 * Exposes payment listing, allocations and reversal operations.
 * Delegates to PaymentsService with validated input and authenticated tenant/actor context.
 */
import { ApiListQuery } from '@common/swagger/decorators/api-list-query.decorator.js';
import { API_ROUTES } from '@common/constants/api-routes.constants.js';
import { API_TAGS } from '@common/constants/api-tags.constants.js';
import { HttpStatus } from '@nestjs/common';
import {
  ApiEnvelope,
  ApiErrorEnvelopes,
} from '@common/swagger/decorators/api-envelope.decorator.js';
import { PaymentResponseDto, PaymentReversalResponseDto } from './dto/payment-response.dto.js';
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListQueryCriteria, type ListQueryOptions } from '@common/query/index.js';
import { PAYMENT_LIST_QUERY } from '../payments.list-query.js';
import { CurrentUser } from '@auth/decorators/current-user.decorator.js';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import type { JwtAuthPayload } from '@auth/types/auth-context.types.js';
import { Roles } from '@auth/decorators/roles.decorator.js';
import { OrganizationRole } from '@generated/prisma/client.js';
import { PaymentsService } from '../application/payments.service.js';
import { QueryPaymentsDto } from './dto/query-payments.dto.js';
import { CreateAllocatedPaymentDto } from './dto/create-allocated-payment.dto.js';
@ApiTags(API_TAGS.PAYMENTS)
@ProtectedApi()
@Controller(API_ROUTES.PAYMENTS.PREFIX)
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
    @ListQueryCriteria(PAYMENT_LIST_QUERY) listQuery: ListQueryOptions,
  ) {
    return this.service.list(q, u.organizationId, listQuery);
  }

  @ApiOperation({
    summary: 'Record a payment and auto-allocate it',
    description:
      "Applies the amount to the party's OPEN/PARTIAL debts of the given type, oldest due date first. " +
      "Rejected when the amount exceeds the party's total remaining balance.",
  })
  @Post(API_ROUTES.PAYMENTS.AUTO_ALLOCATE)
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(PaymentResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorEnvelopes({
    conflict: 'A debt balance needs reconciliation before recording a payment.',
  })
  create(@CurrentUser() u: JwtAuthPayload, @Body() b: CreateAllocatedPaymentDto) {
    return this.service.createAutoAllocated(b, u.organizationId, u.sub);
  }

  @ApiOperation({
    summary: 'Reverse (delete) a payment',
    description:
      'Deletes the voucher and subtracts its allocations from each debt, recomputing OPEN/PARTIAL/PAID.',
  })
  @Delete(API_ROUTES.PAYMENTS.BY_ID)
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
  @ApiEnvelope(PaymentReversalResponseDto)
  @ApiErrorEnvelopes({
    conflict: 'The voucher or a debt balance needs reconciliation before reversal.',
  })
  remove(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string) {
    return this.service.remove(id, u.organizationId, u.sub);
  }
}
