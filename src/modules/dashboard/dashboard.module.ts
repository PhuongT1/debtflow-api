/**
 * Registers dashboard HTTP handlers, metrics and action-center services.
 * Binds repository and action-center reads to their Prisma implementations.
 */
import { DashboardRepository } from './repositories/dashboard.repository.js';
import { PrismaDashboardRepository } from './infrastructure/prisma-dashboard.repository.js';
import { PrismaDashboardActionCenter } from './infrastructure/prisma-dashboard-action-center.js';
import { Module } from '@nestjs/common';
import { DashboardActionCenterService } from './services/dashboard-action-center.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';

@Module({
  controllers: [DashboardController],
  providers: [
    PrismaDashboardActionCenter,
    { provide: DashboardRepository, useClass: PrismaDashboardRepository },
    DashboardActionCenterService,
    DashboardService,
  ],
})
export class DashboardModule {}
