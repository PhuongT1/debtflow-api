import { describe, expect, it, vi } from 'vitest';
import { PrismaDebtsRepository } from '../infrastructure/prisma-debts.repository.js';

describe('Prisma debt write store', () => {
  it('binds related-ID lookups and cancellation to the same scoped client', async () => {
    const party = vi.fn().mockResolvedValue({ id: 'p1' });
    const membership = vi.fn().mockResolvedValue({ id: 'm1' });
    const products = vi.fn().mockResolvedValue([]);
    const find = vi.fn().mockResolvedValue({ id: 'd1', paymentAllocations: [] });
    const update = vi.fn().mockResolvedValue({ id: 'd1', status: 'CANCELLED' });
    const scoped = {
      party: { findFirst: party },
      organizationMembership: { findFirst: membership },
      product: { findMany: products },
      debt: { findUniqueOrThrow: find, update },
    };
    const transaction = vi.fn(async (work) => work(scoped));
    const rootRead = vi.fn(() => {
      throw new Error('Read outside transaction');
    });
    const repository = new PrismaDebtsRepository({
      $transaction: transaction,
      debt: { findUniqueOrThrow: rootRead },
    } as never);
    await repository.inTransaction(async (store) => {
      expect(await store.hasActiveParty('org-1', 'p1')).toBe(true);
      expect(await store.hasActiveMember('org-1', 'u1')).toBe(true);
      await store.products('org-1', ['product-1']);
      await store.findForCancellation('org-1', 'd1');
      await store.cancel('org-1', 'd1');
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(party).toHaveBeenCalledWith({
      where: { id: 'p1', organizationId: 'org-1', isActive: true },
      select: { id: true },
    });
    expect(membership.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      userId: 'u1',
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      organization: { status: 'ACTIVE' },
    });
    expect(products.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      id: { in: ['product-1'] },
      isActive: true,
    });
    expect(find).toHaveBeenCalledWith({
      where: { id: 'd1', organizationId: 'org-1' },
      include: { paymentAllocations: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'd1', organizationId: 'org-1' },
      data: { status: 'CANCELLED' },
    });
    expect(rootRead).not.toHaveBeenCalled();
  });
});
