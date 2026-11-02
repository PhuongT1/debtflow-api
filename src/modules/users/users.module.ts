import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { OrganizationMembersService } from './services/organization-members.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, OrganizationMembersService],
  exports: [OrganizationMembersService],
})
export class UsersModule {}
