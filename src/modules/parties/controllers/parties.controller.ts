import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '#auth/decorators/auth-api.decorator.js';
import { CurrentUser } from '#auth/decorators/current-user.decorator.js';
import type { JwtAuthPayload } from '#auth/types/auth-context.types.js';
import { Roles } from '#auth/decorators/roles.decorator.js';
import { ApiEnvelope, ApiErrorEnvelopes } from '#common/http/api-envelope.decorator.js';
import { ApiListQuery, ListQuery, type ListQueryResult } from '#common/query/index.js';
import { OrganizationRole } from '#generated/prisma/client.js';
import { CreatePartyDto } from '../dto/create-party.dto.js';
import { PartyDetailDto, PartyListItemDto, PartyResponseDto } from '../dto/party-response.dto.js';
import { QueryPartiesDto } from '../dto/query-parties.dto.js';
import { UpdatePartyDto } from '../dto/update-party.dto.js';
import { PARTY_LIST_QUERY } from '../queries/parties.list-query.js';
import { PartiesService } from '../services/parties.service.js';

const ID_PARAM = ApiParam({ name: 'id', description: 'Party id.' });
const WRITERS = [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT];

@ApiTags('Parties')
@ProtectedApi()
@Controller('parties')
export class PartiesController {
  constructor(private readonly service: PartiesService) {}

  @ApiOperation({
    summary: 'List customers and suppliers',
    description:
      'Paginated list of active parties. Each item includes the outstanding receivable/payable ' +
      '`balance`. `sortBy=receivable|payable|outstandingDocuments` sort by derived values.',
  })
  @ApiEnvelope(PartyListItemDto, { paginated: true })
  @ApiListQuery(PARTY_LIST_QUERY)
  @Get()
  list(
    @CurrentUser() u: JwtAuthPayload,
    @Query() q: QueryPartiesDto,
    @ListQuery(PARTY_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.service.list(u.organizationId, q, listQuery);
  }

  @ApiOperation({
    summary: 'Create a party',
    description:
      'The `code` is optional but unique per organization. `assignedToId` must be an active member of the organization.',
  })
  @ApiEnvelope(PartyResponseDto, { status: HttpStatus.CREATED, description: 'Party created.' })
  @ApiErrorEnvelopes({
    badRequest: 'Validation failed, or the assignee is not an active member.',
    conflict: 'The code already exists in this organization.',
  })
  @Post()
  @Roles(...WRITERS)
  create(@CurrentUser() u: JwtAuthPayload, @Body() b: CreatePartyDto) {
    return this.service.create(u.organizationId, u.sub, b);
  }

  @ApiOperation({
    summary: 'Get party detail',
    description: 'Includes the assignee and all debts, nearest due date first.',
  })
  @ApiEnvelope(PartyDetailDto)
  @ApiErrorEnvelopes({ notFound: 'The party does not exist in this organization.' })
  @ID_PARAM
  @Get(':id')
  detail(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string) {
    return this.service.detail(u.organizationId, id);
  }

  @ApiOperation({
    summary: 'Update a party',
    description:
      'Partial update: only the fields you send change. A blank or null value clears an optional ' +
      'field; `name` and `type` cannot be cleared.',
  })
  @ApiEnvelope(PartyResponseDto)
  @ApiErrorEnvelopes({
    badRequest: 'Validation failed, or the assignee is not an active member.',
    notFound: 'The party does not exist in this organization.',
    conflict: 'The code already exists in this organization.',
  })
  @ID_PARAM
  @Patch(':id')
  @Roles(...WRITERS)
  update(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string, @Body() b: UpdatePartyDto) {
    return this.service.update(u.organizationId, id, b, u.sub);
  }

  @ApiOperation({
    summary: 'Deactivate a party',
    description: 'Soft delete (`isActive=false`). Rejected while the party has unsettled debts.',
  })
  @ApiEnvelope(PartyResponseDto)
  @ApiErrorEnvelopes({
    badRequest: 'The party still has unsettled debts.',
    notFound: 'The party does not exist in this organization.',
  })
  @ID_PARAM
  @Delete(':id')
  @Roles(...WRITERS)
  remove(@CurrentUser() u: JwtAuthPayload, @Param('id') id: string) {
    return this.service.deactivate(u.organizationId, id, u.sub);
  }
}
