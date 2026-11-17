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

/**
 * Plain JSON snapshot of a record's own columns: relations (objects and arrays) are dropped, Decimals
 * and Dates become strings. Keeps audit rows small and safe to store in a Json column.
 */
export function scalarSnapshot(record: object | null | undefined): Record<string, unknown> | null {
  if (!record) return null;

  const entries = Object.entries(record).filter(([, value]) => {
    if (Array.isArray(value)) return false;
    if (value === null || typeof value !== 'object') return true;

    return value instanceof Date || typeof (value as { toJSON?: unknown }).toJSON === 'function';
  });

  return JSON.parse(JSON.stringify(Object.fromEntries(entries)));
}
