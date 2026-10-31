import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { CurrentUser } from '@auth/current-user.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { Roles } from '@auth/roles.decorator';
import { ApiErrorEnvelopes, ApiEnvelope } from '@common/http/api-envelope.decorator';
import { ApiListQuery, ListQuery, type ListQueryResult } from '@common/query';
import { OrganizationRole } from '@generated/prisma';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MemberDto, UserOptionDto } from './dto/user-response.dto';
import { USER_LIST_QUERY } from './users.list-query';
import type { Actor } from './users.rules';
import { UsersService } from './users.service';

const ID_PARAM = ApiParam({ name: 'id', description: 'User id (the `id` returned by the list).' });

const toActor = (user: JwtAuthPayload): Actor => ({ userId: user.sub, role: user.role });

@ApiTags('Users')
@ProtectedApi()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'List members as select options',
    description: 'Lightweight list of active members used by assignee pickers.',
  })
  @ApiEnvelope(UserOptionDto, { isArray: true })
  @Get('options')
  options(@CurrentUser() user: JwtAuthPayload) {
    return this.usersService.options(user.organizationId);
  }

  @ApiOperation({
    summary: 'List organization members',
    description:
      'Paginated members of the current organization. `status` is the effective status; ' +
      '`membershipStatus` and `userStatus` give the details.',
  })
  @ApiEnvelope(MemberDto, { paginated: true })
  @ApiListQuery(USER_LIST_QUERY)
  @Get()
  list(
    @CurrentUser() user: JwtAuthPayload,
    @Query() query: QueryUsersDto,
    @ListQuery(USER_LIST_QUERY) listQuery: ListQueryResult,
  ) {
    return this.usersService.list(user.organizationId, query, listQuery);
  }

  @ApiOperation({
    summary: 'Create a member',
    description:
      'Creates a new account with an initial password and adds it to the organization as an ACTIVE member. ' +
      'Only an OWNER can create another OWNER.',
  })
  @ApiEnvelope(MemberDto, { status: HttpStatus.CREATED, description: 'Member created.' })
  @ApiErrorEnvelopes({
    badRequest: 'Validation failed.',
    conflict: 'The email or phone already belongs to an account.',
  })
  @Post()
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  create(@CurrentUser() user: JwtAuthPayload, @Body() body: CreateUserDto) {
    return this.usersService.create(user.organizationId, body, toActor(user));
  }

  @ApiOperation({
    summary: 'Update a member',
    description:
      'Changes the role in this organization and/or the name and phone. Name and phone belong to the ' +
      'account, so they can only be edited by the user themselves or, for an account that belongs to no ' +
      'other organization, by an admin. You cannot change your own role; touching or granting OWNER requires an OWNER.',
  })
  @ApiEnvelope(MemberDto)
  @ApiErrorEnvelopes({
    badRequest: 'Validation failed.',
    notFound: 'The user is not a member of this organization.',
    conflict: 'The phone already belongs to another account.',
  })
  @ID_PARAM
  @Patch(':id')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  update(
    @CurrentUser() user: JwtAuthPayload,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.update(user.organizationId, id, body, toActor(user));
  }

  @ApiOperation({
    summary: 'Suspend a member',
    description:
      'Sets the membership to SUSPENDED: the user can no longer use this organization. The account and ' +
      'its other organizations are untouched. You cannot suspend yourself; suspending an OWNER requires an OWNER.',
  })
  @ApiEnvelope(MemberDto)
  @ApiErrorEnvelopes({
    badRequest: 'The member is already suspended.',
    notFound: 'The user is not a member of this organization.',
  })
  @ID_PARAM
  @Delete(':id')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  deactivate(@CurrentUser() user: JwtAuthPayload, @Param('id') id: string) {
    return this.usersService.deactivate(user.organizationId, id, toActor(user));
  }

  @ApiOperation({
    summary: 'Reactivate a member',
    description: 'Sets a suspended or invited membership back to ACTIVE.',
  })
  @ApiEnvelope(MemberDto)
  @ApiErrorEnvelopes({
    badRequest: 'The member is already active.',
    notFound: 'The user is not a member of this organization.',
  })
  @ID_PARAM
  @HttpCode(HttpStatus.OK)
  @Post(':id/reactivate')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  reactivate(@CurrentUser() user: JwtAuthPayload, @Param('id') id: string) {
    return this.usersService.reactivate(user.organizationId, id, toActor(user));
  }
}
