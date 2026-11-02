import { Module } from '@nestjs/common';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AuditLogsListener } from './listeners/audit-logs.listener';
import { AuditLogsService } from './services/audit-logs.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsListener],
})
export class AuditLogsModule {}
