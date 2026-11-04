import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller.js';
import { UsersService } from './services/users.service.js';
import { OrganizationMembersService } from './services/organization-members.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, OrganizationMembersService],
  exports: [OrganizationMembersService],
})
export class UsersModule {}
