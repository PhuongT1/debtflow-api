import { PrismaAuditLogsRepository } from '../infrastructure/prisma-audit-logs.repository.js';
import { describe, expect, it, vi } from 'vitest';
import { AuditAction } from '@common/events/audit-event.js';
import { AuditLogsListener } from '../audit-logs.listener.js';

const entry = {
  organizationId: 'org-1',
  actorId: 'u1',
  entityType: 'Debt',
  entityId: 'd1',
  action: AuditAction.DebtCancelled,
  before: { status: 'OPEN' },
  after: { status: 'CANCELLED' },
};

describe('AuditLogsListener', () => {
  it('stores the entry in the organization it belongs to', async () => {
    const create = vi.fn().mockResolvedValue({});
    const listener = new AuditLogsListener(
      new PrismaAuditLogsRepository({ auditLog: { create } } as never),
    );

    await listener.handle(entry);

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        actorId: 'u1',
        entityType: 'Debt',
        entityId: 'd1',
        action: 'debt.cancelled',
        before: { status: 'OPEN' },
        after: { status: 'CANCELLED' },
      },
    });
  });

  it('stores a system action without an actor', async () => {
    const create = vi.fn().mockResolvedValue({});
    const listener = new AuditLogsListener(
      new PrismaAuditLogsRepository({ auditLog: { create } } as never),
    );

    await listener.handle({ ...entry, actorId: undefined, before: undefined });

    expect(create.mock.calls[0][0].data).toMatchObject({ actorId: null, before: undefined });
  });

  it('never throws into the request when storing fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('db down'));
    const listener = new AuditLogsListener(
      new PrismaAuditLogsRepository({ auditLog: { create } } as never),
    );

    await expect(listener.handle(entry)).resolves.toBeUndefined();
  });
});
