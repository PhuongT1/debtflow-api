import type { EventEmitter2 } from '@nestjs/event-emitter';

import { AUDIT_EVENT, type AuditEntry } from './audit.types.js';
export { AUDIT_EVENT, AuditAction } from './audit.types.js';
export type { AuditEntry, AuditActionName } from './audit.types.js';

/**
 * Publishes an audited change. Services call this after the change succeeded and know nothing about
 * how or where it is stored (`AuditLogsListener` writes the row), the same decoupling Vendure gets
 * from its event bus.
 */
export function emitAudit(events: EventEmitter2, entry: AuditEntry) {
  events.emit(AUDIT_EVENT, entry);
}

export { scalarSnapshot } from './audit-snapshot.js';
