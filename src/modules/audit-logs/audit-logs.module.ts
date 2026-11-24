/**
 * Registers audit-log HTTP handlers, read service and the audit event listener.
 * Binds AuditLogsRepository to its Prisma adapter for audit reads and persistence.
 */
import { AuditLogsRepository } from './application/repositories/audit-logs.repository.js';
import { PrismaAuditLogsRepository } from './infrastructure/prisma-audit-logs.repository.js';
import { Module } from '@nestjs/common';
import { AuditLogsController } from './presentation/audit-logs.controller.js';
import { AuditLogsListener } from './infrastructure/audit-logs.listener.js';
import { AuditLogsService } from './application/audit-logs.service.js';

@Module({
  controllers: [AuditLogsController],
  providers: [
    { provide: AuditLogsRepository, useClass: PrismaAuditLogsRepository },
    {
      provide: AuditLogsService,
      inject: [AuditLogsRepository],
      useFactory: (repository: AuditLogsRepository) => new AuditLogsService(repository),
    },
    AuditLogsListener,
  ],
})
export class AuditLogsModule {}
