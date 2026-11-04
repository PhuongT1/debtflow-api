import { Module } from '@nestjs/common';
import { DashboardActionCenterService } from './services/dashboard-action-center.service.js';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardService } from './services/dashboard.service.js';

@Module({
  controllers: [DashboardController],
  providers: [DashboardActionCenterService, DashboardService],
})
export class DashboardModule {}
