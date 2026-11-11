import { describe, expect, it, vi } from 'vitest';
import { DebtsService } from '../services/debts.service.js';
import type { DebtWriteStore } from '../repositories/debts.repository.js';

const input = {
  partyId: 'party-1',
  assignedToId: 'member-1',
  title: 'Invoice',
  type: 'RECEIVABLE' as const,
  originalAmount: '100',
  issueDate: '2026-11-01',
  dueDate: '2026-11-02',
};
function setup() {
  const store = {
    hasActiveParty: vi.fn().mockResolvedValue(true),
    hasActiveMember: vi.fn().mockResolvedValue(true),
    products: vi.fn().mockResolvedValue([]),
    nextCode: vi.fn().mockResolvedValue('CN-202611-0001'),
    create: vi.fn().mockResolvedValue({ id: 'd1' }),
    updateCollection: vi.fn().mockResolvedValue({ id: 'd1' }),
    findForCancellation: vi.fn().mockResolvedValue({ id: 'd1', paymentAllocations: [] }),
    cancel: vi.fn().mockResolvedValue({ id: 'd1', status: 'CANCELLED' }),
  };
  const repository = {
    inTransaction: vi.fn(async (work: (s: DebtWriteStore) => unknown) => work(store)),
    detail: vi.fn().mockResolvedValue({ id: 'd1', paymentAllocations: [] }),
    list: vi.fn(),
  };
  const items = { prepare: vi.fn().mockResolvedValue([]) };
  const events = { emit: vi.fn() };
  return {
    service: new DebtsService(repository as never, items as never, events as never),
    repository,
    store,
    items,
    events,
  };
}
describe('debt application service using a fake persistence port', () => {
  it.each([undefined, null, '', ' '])(
    'rejects tenant %s before repository/audit access',
    async (organizationId) => {
      const s = setup();
      await expect(s.service.list(organizationId as never, {})).rejects.toMatchObject({
        status: 403,
      });
      await expect(s.service.detail('d1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      await expect(s.service.create(input, organizationId as never, 'actor')).rejects.toMatchObject(
        { status: 403 },
      );
      await expect(
        s.service.updateCollection('d1', {}, organizationId as never),
      ).rejects.toMatchObject({ status: 403 });
      await expect(s.service.cancel('d1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      expect(s.repository.inTransaction).not.toHaveBeenCalled();
      expect(s.repository.detail).not.toHaveBeenCalled();
      expect(s.events.emit).not.toHaveBeenCalled();
    },
  );
  it('validates related ownership inside one store and audits after it commits', async () => {
    const s = setup();
    await s.service.create(input, 'org-1', 'actor');
    expect(s.store.hasActiveParty).toHaveBeenCalledWith('org-1', 'party-1');
    expect(s.store.hasActiveMember).toHaveBeenCalledWith('org-1', 'member-1');
    expect(s.store.products).not.toHaveBeenCalled();
    expect(s.items.prepare).toHaveBeenCalledWith(undefined, expect.anything(), []);
    expect(s.store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        partyId: 'party-1',
        createdById: 'actor',
      }),
    );
    expect(s.events.emit.mock.invocationCallOrder[0]).toBeGreaterThan(
      s.store.create.mock.invocationCallOrder[0],
    );
  });
  it('rejects foreign/inactive parties and members before persistence', async () => {
    const s = setup();
    s.store.hasActiveParty.mockResolvedValue(false);
    await expect(s.service.create(input, 'org-1', 'actor')).rejects.toMatchObject({ status: 404 });
    s.store.hasActiveParty.mockResolvedValue(true);
    s.store.hasActiveMember.mockResolvedValue(false);
    await expect(s.service.create(input, 'org-1', 'actor')).rejects.toMatchObject({ status: 400 });
    expect(s.store.create).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
  it('does not audit rolled-back changes', async () => {
    const s = setup();
    s.store.create.mockRejectedValue(new Error('write failed'));
    await expect(s.service.create(input, 'org-1', 'actor')).rejects.toThrow('write failed');
    expect(s.events.emit).not.toHaveBeenCalled();
  });
  it('checks allocations and cancels within the same transaction-scoped store', async () => {
    const s = setup();
    await s.service.cancel('d1', 'org-1', 'actor');
    expect(s.store.findForCancellation).toHaveBeenCalledWith('org-1', 'd1');
    expect(s.store.cancel).toHaveBeenCalledWith('org-1', 'd1');
    s.events.emit.mockClear();
    s.store.cancel.mockClear();
    s.store.findForCancellation.mockResolvedValue({
      id: 'd1',
      paymentAllocations: [{}] as never[],
    });
    await expect(s.service.cancel('d1', 'org-1', 'actor')).rejects.toMatchObject({ status: 400 });
    expect(s.store.cancel).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
});
