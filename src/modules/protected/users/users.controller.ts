import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '@auth/current-user.decorator';
import { ProtectedApi } from '@auth/auth-api.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { Roles } from '@auth/roles.decorator';
import { OrganizationRole } from '@generated/prisma';
import { UpdateUserDto } from './dto/update-user.dto'; import { QueryUsersDto } from './dto/query-users.dto'; import { UsersService } from './users.service';
@ProtectedApi() @Controller('users') export class UsersController { constructor(private readonly usersService: UsersService) {}
 @Get('options') options(@CurrentUser() user:JwtAuthPayload){return this.usersService.options(user.organizationId)}
 @Get() list(@CurrentUser() user:JwtAuthPayload,@Query() query:QueryUsersDto){return this.usersService.list(user.organizationId,query)}
 @Patch(':id') @Roles(OrganizationRole.OWNER,OrganizationRole.ADMIN) update(@CurrentUser() user:JwtAuthPayload,@Param('id') id:string,@Body() body:UpdateUserDto){return this.usersService.update(user.organizationId,id,body)}
 @Delete(':id') @Roles(OrganizationRole.OWNER,OrganizationRole.ADMIN) deactivate(@CurrentUser() user:JwtAuthPayload,@Param('id') id:string){return this.usersService.deactivate(user.organizationId,id)}
}