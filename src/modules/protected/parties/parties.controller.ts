import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@auth/current-user.decorator'; import { ProtectedApi } from '@auth/auth-api.decorator'; import type { JwtAuthPayload } from '@auth/jwt-auth.guard'; import { Roles } from '@auth/roles.decorator'; import { OrganizationRole } from '@generated/prisma';
import { PartiesService } from './parties.service'; import { CreatePartyDto } from './dto/create-party.dto'; import { QueryPartiesDto } from './dto/query-parties.dto'; import { UpdatePartyDto } from './dto/update-party.dto';
@ProtectedApi() @Controller('parties') export class PartiesController { constructor(private readonly service:PartiesService){}
@Get() list(@CurrentUser() u:JwtAuthPayload,@Query() q:QueryPartiesDto){return this.service.list(u.organizationId,q)}
@Post() @Roles(OrganizationRole.OWNER,OrganizationRole.ADMIN,OrganizationRole.ACCOUNTANT) create(@CurrentUser()u:JwtAuthPayload,@Body()b:CreatePartyDto){return this.service.create(u.organizationId,u.sub,b)}
@Get(':id') detail(@CurrentUser()u:JwtAuthPayload,@Param('id')id:string){return this.service.detail(u.organizationId,id)}
@Patch(':id') @Roles(OrganizationRole.OWNER,OrganizationRole.ADMIN,OrganizationRole.ACCOUNTANT) update(@CurrentUser()u:JwtAuthPayload,@Param('id')id:string,@Body()b:UpdatePartyDto){return this.service.update(u.organizationId,id,b)}
@Delete(':id') @Roles(OrganizationRole.OWNER,OrganizationRole.ADMIN,OrganizationRole.ACCOUNTANT) remove(@CurrentUser()u:JwtAuthPayload,@Param('id')id:string){return this.service.deactivate(u.organizationId,id)} }
