import { describe, expect, it, vi } from 'vitest';
import { DebtsService } from './debts.service.js';

describe('debt query and required tenant context', () => {
  it.each([undefined, null, '', ' '])(
    'rejects tenant %s before reads, writes or audit publication',
    async (organizationId) => {
      const transaction = vi.fn();
      const findFirstOrThrow = vi.fn();
      const create = vi.fn();
      const events = { emit: vi.fn() };
      const service = new DebtsService(
        { $transaction: transaction, debt: { findFirstOrThrow, create } } as never,
        {} as never,
        events as never,
        {} as never,
        {} as never,
      );
      await expect(service.list(organizationId as never, {})).rejects.toMatchObject({
        status: 403,
      });
      await expect(service.detail('d1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        service.create({} as never, organizationId as never, 'actor'),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.updateCollection('d1', {} as never, organizationId as never),
      ).rejects.toMatchObject({ status: 403 });
      await expect(service.cancel('d1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(findFirstOrThrow).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    },
  );
});

const input = {
  partyId: 'party-1',
  assignedToId: 'member-1',
  title: 'Invoice',
  type: 'RECEIVABLE' as const,
  originalAmount: '100',
  issueDate: '2026-11-01',
  dueDate: '2026-11-02',
};
function setupWrite() {
  const tx = {
    debt: {
      create: vi.fn().mockResolvedValue({ id: 'd1' }),
      update: vi.fn().mockResolvedValue({ id: 'd1' }),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  const transaction = vi.fn(async (run: (db: typeof tx) => unknown) => run(tx));
  const findFirstOrThrow = vi.fn().mockResolvedValue({ id: 'd1', paymentAllocations: [] });
  const parties = { assertActive: vi.fn().mockResolvedValue(undefined) };
  const members = { isActive: vi.fn().mockResolvedValue(true) };
  const items = { prepare: vi.fn().mockResolvedValue([]) };
  const events = { emit: vi.fn() };
  const service = new DebtsService(
    { $transaction: transaction, debt: { findFirstOrThrow } } as never,
    items as never,
    events as never,
    parties as never,
    members as never,
  );
  return { service, tx, transaction, parties, members, events, items };
}

describe('scoped debt writes', () => {
  it('checks the party and assignee with the transaction client and emits only after success', async () => {
    const s = setupWrite();
    await s.service.create(input, 'org-1', 'actor-1');
    expect(s.parties.assertActive).toHaveBeenCalledWith('org-1', 'party-1', s.tx);
    expect(s.members.isActive).toHaveBeenCalledWith('org-1', 'member-1', s.tx);
    expect(s.items.prepare).toHaveBeenCalledWith(undefined, expect.anything(), 'org-1', s.tx);
    expect(s.tx.debt.create.mock.calls[0][0].data).toMatchObject({
      organizationId: 'org-1',
      partyId: 'party-1',
      assignedToId: 'member-1',
      createdById: 'actor-1',
    });
    expect(s.events.emit.mock.invocationCallOrder[0]).toBeGreaterThan(
      s.tx.debt.create.mock.invocationCallOrder[0],
    );
  });
  it('rejects a foreign or inactive party before creating anything', async () => {
    const s = setupWrite();
    s.parties.assertActive.mockRejectedValue({ status: 404 });
    await expect(s.service.create(input, 'org-1', 'actor-1')).rejects.toMatchObject({
      status: 404,
    });
    expect(s.tx.debt.create).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
  it('rejects a foreign/inactive assignee on both create and PATCH', async () => {
    const s = setupWrite();
    s.members.isActive.mockResolvedValue(false);
    await expect(s.service.create(input, 'org-1', 'actor-1')).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      s.service.updateCollection('d1', { assignedToId: 'foreign' }, 'org-1'),
    ).rejects.toMatchObject({ status: 400 });
    expect(s.tx.debt.create).not.toHaveBeenCalled();
    expect(s.tx.debt.update).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
  it('preserves omitted fields and allows explicitly clearing the assignee', async () => {
    const s = setupWrite();
    await s.service.updateCollection('d1', { collectionStatus: 'CONTACTED' }, 'org-1');
    expect(s.tx.debt.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'd1', organizationId: 'org-1' },
      data: { collectionStatus: 'CONTACTED' },
    });
    expect(s.tx.debt.update.mock.calls[0][0].data).not.toHaveProperty('assignedToId');
    await s.service.updateCollection('d1', { assignedToId: null }, 'org-1');
    expect(s.tx.debt.update.mock.calls[1][0].data).toEqual({ assignedToId: null });
    expect(s.members.isActive).not.toHaveBeenCalled();
  });
  it('does not publish audit when a transaction fails', async () => {
    const s = setupWrite();
    s.tx.debt.create.mockRejectedValue(new Error('write failed'));
    await expect(s.service.create(input, 'org-1', 'actor-1')).rejects.toThrow('write failed');
    expect(s.events.emit).not.toHaveBeenCalled();
  });
});
