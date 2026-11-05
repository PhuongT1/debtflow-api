import { ReportsRepository } from './repositories/reports.repository.js';
import { PrismaReportsRepository } from './infrastructure/prisma-reports.repository.js';
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [{ provide: ReportsRepository, useClass: PrismaReportsRepository }, ReportsService],
})
export class ReportsModule {}
