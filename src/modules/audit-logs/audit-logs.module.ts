/**
 * Registers audit-log HTTP handlers, read service and the audit event listener.
 * Binds AuditLogsRepository to its Prisma adapter for audit reads and persistence.
 */
import { AuditLogsRepository } from './repositories/audit-logs.repository.js';
import { PrismaAuditLogsRepository } from './infrastructure/prisma-audit-logs.repository.js';
import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsListener } from './audit-logs.listener.js';
import { AuditLogsService } from './audit-logs.service.js';

@Module({
  controllers: [AuditLogsController],
  providers: [
    { provide: AuditLogsRepository, useClass: PrismaAuditLogsRepository },
    AuditLogsService,
    AuditLogsListener,
  ],
})
export class AuditLogsModule {}
