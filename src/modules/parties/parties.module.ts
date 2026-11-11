/**
 * Registers Party HTTP handlers and the application service.
 * Binds PartiesRepository to PrismaPartiesRepository and imports member-access providers.
 */
import { PartiesRepository } from './repositories/parties.repository.js';
import { PrismaPartiesRepository } from './infrastructure/prisma-parties.repository.js';
import { Module } from '@nestjs/common';
import { PartiesController } from './parties.controller.js';
import { PartiesService } from './parties.service.js';
import { UsersModule } from '@modules/users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [PartiesController],
  providers: [PartiesService, { provide: PartiesRepository, useClass: PrismaPartiesRepository }],
})
export class PartiesModule {}
