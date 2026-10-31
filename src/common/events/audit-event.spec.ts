import { describe, expect, it, vi } from 'vitest';
import { AUDIT_EVENT, AuditAction, emitAudit, scalarSnapshot } from './audit-event';

describe('scalarSnapshot', () => {
  it('returns null for a missing record', () => {
    expect(scalarSnapshot(null)).toBeNull();
    expect(scalarSnapshot(undefined)).toBeNull();
  });

  it('keeps columns, stringifies Decimals and Dates, drops relations', () => {
    const decimal = { toJSON: () => '1250000.50' };
    const snapshot = scalarSnapshot({
      id: 'd1',
      amount: decimal,
      dueDate: new Date('2026-10-30T00:00:00Z'),
      note: null,
      party: { id: 'p1', name: 'A' },
      items: [{ id: 'i1' }],
    });

    expect(snapshot).toEqual({
      id: 'd1',
      amount: '1250000.50',
      dueDate: '2026-10-30T00:00:00.000Z',
      note: null,
    });
  });
});

describe('emitAudit', () => {
  it('publishes the entry under the audit event name', () => {
    const emit = vi.fn();
    const entry = {
      organizationId: 'org-1',
      actorId: 'u1',
      entityType: 'Debt',
      entityId: 'd1',
      action: AuditAction.DebtCreated,
    };

    emitAudit({ emit } as never, entry);

    expect(emit).toHaveBeenCalledWith(AUDIT_EVENT, entry);
  });
});
