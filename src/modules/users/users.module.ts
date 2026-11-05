import { UsersRepository } from './repositories/users.repository.js';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository.js';
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './services/users.service.js';
import { OrganizationMembersService } from './services/organization-members.service.js';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    OrganizationMembersService,
    { provide: UsersRepository, useClass: PrismaUsersRepository },
  ],
  exports: [OrganizationMembersService],
})
export class UsersModule {}
