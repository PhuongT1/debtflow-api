import { Module } from '@nestjs/common';
import { DashboardActionCenterService } from './dashboard-action-center.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardActionCenterService, DashboardService],
})
export class DashboardModule {}
