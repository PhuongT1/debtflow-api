/**
 * Registers debt report HTTP handlers and the application service.
 * Binds ReportsRepository to its Prisma adapter for tenant-scoped report reads.
 */
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
