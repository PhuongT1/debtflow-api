/**
 * Registers organization member HTTP handlers and application services.
 * Binds UsersRepository to its Prisma adapter and exports intended member-access providers.
 */
import { UsersRepository } from './application/repositories/users.repository.js';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository.js';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { emitAudit } from '@common/events/audit-event.js';
import { hashMemberPassword } from './infrastructure/hash-member-password.js';
import { Module } from '@nestjs/common';
import { UsersController } from './presentation/users.controller.js';
import { UsersService } from './application/users.service.js';
import { OrganizationMembersService } from './application/organization-members.service.js';

@Module({
  controllers: [UsersController],
  providers: [
    {
      provide: UsersService,
      inject: [UsersRepository, EventEmitter2],
      useFactory: (repository: UsersRepository, events: EventEmitter2) =>
        new UsersService(repository, (entry) => emitAudit(events, entry), hashMemberPassword),
    },
    {
      provide: OrganizationMembersService,
      inject: [UsersRepository],
      useFactory: (repository: UsersRepository) => new OrganizationMembersService(repository),
    },
    { provide: UsersRepository, useClass: PrismaUsersRepository },
  ],
  exports: [OrganizationMembersService],
})
export class UsersModule {}
