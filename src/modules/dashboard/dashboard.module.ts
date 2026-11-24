/**
 * Registers the dashboard HTTP handler and application service.
 * Binds repository and action-center reads to their Prisma implementations.
 */
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository.js';
import { PrismaDashboardActionCenter } from './infrastructure/prisma-dashboard-action-center.js';
import { Module } from '@nestjs/common';
import { DashboardController } from './presentation/dashboard.controller.js';
import { DashboardService } from './application/dashboard.service.js';

@Module({
  controllers: [DashboardController],
  providers: [
    PrismaDashboardActionCenter,
    PrismaDashboardRepository,
    {
      provide: DashboardService,
      inject: [PrismaDashboardRepository],
      useFactory: (repository: PrismaDashboardRepository) => new DashboardService(repository),
    },
  ],
})
export class DashboardModule {}
