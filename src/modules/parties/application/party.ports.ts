import type { AuditEntry } from '@common/events/audit.types.js';
import type { PartyRecord } from './party-read.types.js';

export type PartyAuditEntry = Omit<AuditEntry, 'before' | 'after'> & {
  before?: PartyRecord;
  after?: PartyRecord;
};
export interface PartyAudit {
  record(entry: PartyAuditEntry): void;
}
export interface PartyMembers {
  isActive(organizationId: string, userId: string): Promise<boolean>;
}
