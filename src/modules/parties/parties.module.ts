/**
 * Registers Party HTTP handlers and the application service.
 * Binds PartiesRepository to PrismaPartiesRepository and imports member-access providers.
 */
import { PartiesRepository } from './application/repositories/parties.repository.js';
import { PrismaPartiesRepository } from './infrastructure/prisma-parties.repository.js';
import { Module } from '@nestjs/common';
import { PartiesController } from './presentation/parties.controller.js';
import { PartiesService } from './application/parties.service.js';
import { PartyAuditAdapter } from './infrastructure/party-audit.adapter.js';
import { OrganizationMembersService } from '@modules/users/public/users.js';
import { UsersModule } from '@modules/users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [PartiesController],
  providers: [
    { provide: PartiesRepository, useClass: PrismaPartiesRepository },
    PartyAuditAdapter,
    {
      provide: PartiesService,
      inject: [PartiesRepository, PartyAuditAdapter, OrganizationMembersService],
      useFactory: (
        repository: PartiesRepository,
        audit: PartyAuditAdapter,
        members: OrganizationMembersService,
      ) => new PartiesService(repository, audit, members),
    },
  ],
})
export class PartiesModule {}
