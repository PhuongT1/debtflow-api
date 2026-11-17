/** Name of the event every audited change is published under. */
export const AUDIT_EVENT = 'audit.recorded';

export const AuditAction = {
  DebtCreated: 'debt.created',
  DebtUpdated: 'debt.updated',
  DebtCancelled: 'debt.cancelled',
  PaymentCreated: 'payment.created',
  PaymentReversed: 'payment.reversed',
  PartyCreated: 'party.created',
  PartyUpdated: 'party.updated',
  PartyDeactivated: 'party.deactivated',
  MemberCreated: 'member.created',
  MemberUpdated: 'member.updated',
  MemberSuspended: 'member.suspended',
  MemberReactivated: 'member.reactivated',
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

export type AuditEntry = {
  organizationId: string;
  /** User who performed the change. Null for system actions. */
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: AuditActionName;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};
