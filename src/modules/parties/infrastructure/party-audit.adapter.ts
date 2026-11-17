import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { emitAudit, scalarSnapshot } from '@common/events/audit-event.js';
import type { PartyAudit, PartyAuditEntry } from '../application/party.ports.js';

/** Adapts committed application outcomes to the existing best-effort audit event bus. */
@Injectable()
export class PartyAuditAdapter implements PartyAudit {
  constructor(private readonly events: EventEmitter2) {}

  record({ before, after, ...entry }: PartyAuditEntry): void {
    emitAudit(this.events, {
      ...entry,
      ...(before ? { before: scalarSnapshot(before) } : {}),
      ...(after ? { after: scalarSnapshot(after) } : {}),
    });
  }
}
