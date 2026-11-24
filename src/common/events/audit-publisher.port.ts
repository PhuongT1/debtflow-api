import type { AuditEntry } from './audit.types.js';

export type PublishAudit = (entry: AuditEntry) => void;
