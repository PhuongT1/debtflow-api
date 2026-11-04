import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUDIT_EVENT, type AuditEntry } from '#common/events/audit-event.js';
import { PrismaService } from '#database/prisma.service.js';
import type { Prisma } from '#generated/prisma/client.js';

/** Stores every published audit entry. A failure is logged and never reaches the request. */
@Injectable()
export class AuditLogsListener {
  private readonly logger = new Logger(AuditLogsListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(AUDIT_EVENT)
  async handle(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          actorId: entry.actorId ?? null,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not store audit entry ${entry.action} ${entry.entityType}:${entry.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
