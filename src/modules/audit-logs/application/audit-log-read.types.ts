import type { PaginationInput } from '@common/utils/pagination.util.js';

export type AuditLogListInput = PaginationInput & {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
};

export type AuditLogRecord = {
  id: string;
  organizationId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  actor: { id: string; name: string; email: string } | null;
};
