import { Module } from '@nestjs/common';
import { DashboardActionCenterService } from './services/dashboard-action-center.service';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardActionCenterService, DashboardService],
})
export class DashboardModule {}
