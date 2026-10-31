import { defineListQuery } from '@common/query';

/** Fields clients may filter and sort on for `GET /audit-logs`. */
export const AUDIT_LOG_LIST_QUERY = defineListQuery({
  model: 'AuditLog',
  fields: {
    actorId: { type: 'string', nullable: true, sortable: false },
    entityType: { type: 'string' },
    entityId: { type: 'string', sortable: false },
    action: { type: 'string' },
    createdAt: { type: 'date' },
  },
});
