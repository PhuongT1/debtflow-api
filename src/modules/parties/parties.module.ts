/**
 * Registers Party HTTP handlers and the application service.
 * Binds PartiesRepository to PrismaPartiesRepository and wires the audit adapter.
 */
import { PartiesRepository } from './application/repositories/parties.repository.js';
import { PrismaPartiesRepository } from './infrastructure/prisma-parties.repository.js';
import { Module } from '@nestjs/common';
import { PartiesController } from './presentation/parties.controller.js';
import { PartiesService } from './application/parties.service.js';
import { PartyAuditAdapter } from './infrastructure/party-audit.adapter.js';

@Module({
  controllers: [PartiesController],
  providers: [
    { provide: PartiesRepository, useClass: PrismaPartiesRepository },
    PartyAuditAdapter,
    {
      provide: PartiesService,
      inject: [PartiesRepository, PartyAuditAdapter],
      useFactory: (repository: PartiesRepository, audit: PartyAuditAdapter) =>
        new PartiesService(repository, audit),
    },
  ],
})
export class PartiesModule {}
