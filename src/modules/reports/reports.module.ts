/**
 * Registers debt report HTTP handlers and the application service.
 * Binds ReportsRepository to its Prisma adapter for tenant-scoped report reads.
 */
import { ReportsRepository } from './application/repositories/reports.repository.js';
import { PrismaReportsRepository } from './infrastructure/prisma-reports.repository.js';
import { Module } from '@nestjs/common';
import { ReportsController } from './presentation/reports.controller.js';
import { ReportsService } from './application/reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [
    { provide: ReportsRepository, useClass: PrismaReportsRepository },
    {
      provide: ReportsService,
      inject: [ReportsRepository],
      useFactory: (repository: ReportsRepository) => new ReportsService(repository),
    },
  ],
})
export class ReportsModule {}
