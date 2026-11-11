import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUDIT_EVENT, type AuditEntry } from '@common/events/audit-event.js';
import { AuditLogsRepository } from './repositories/audit-logs.repository.js';

/** Stores every published audit entry. A failure is logged and never reaches the request. */
@Injectable()
export class AuditLogsListener {
  private readonly logger = new Logger(AuditLogsListener.name);

  constructor(private readonly repository: AuditLogsRepository) {}

  @OnEvent(AUDIT_EVENT)
  async handle(entry: AuditEntry) {
    try {
      await this.repository.record(entry);
    } catch (error) {
      this.logger.error(
        `Could not store audit entry ${entry.action} ${entry.entityType}:${entry.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
