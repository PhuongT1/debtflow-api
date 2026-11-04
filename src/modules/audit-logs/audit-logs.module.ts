import { Module } from '@nestjs/common';
import { AuditLogsController } from './controllers/audit-logs.controller.js';
import { AuditLogsListener } from './listeners/audit-logs.listener.js';
import { AuditLogsService } from './services/audit-logs.service.js';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsListener],
})
export class AuditLogsModule {}
