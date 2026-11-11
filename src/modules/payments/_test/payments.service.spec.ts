import { PrismaPaymentsRepository } from '../infrastructure/prisma-payments.repository.js';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { PaymentsService } from '../payments.service.js';

function setup() {
  const debt = {
    id: 'd1',
    organizationId: 'org-1',
    partyId: 'p1',
    type: 'RECEIVABLE',
    status: 'PARTIAL',
    originalAmount: new Prisma.Decimal(100),
    paidAmount: new Prisma.Decimal(20),
  };
  const payment = {
    id: 'pay-1',
    organizationId: 'org-1',
    allocations: [{ debtId: 'd1', amount: new Prisma.Decimal(10), debt }],
  };
  const tx = {
    debt: {
      findFirstOrThrow: vi.fn().mockResolvedValue(debt),
      findMany: vi.fn().mockResolvedValue([debt]),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      create: vi.fn().mockResolvedValue(payment),
      findFirstOrThrow: vi.fn().mockResolvedValue(payment),
      delete: vi.fn().mockResolvedValue(payment),
    },
  };
  const transaction = vi.fn(async (run: (client: typeof tx) => unknown) => run(tx));
  const events = { emit: vi.fn() };
  const service = new PaymentsService(
    new PrismaPaymentsRepository({ $transaction: transaction } as never),
    events as never,
  );
  return { service, tx, debt, payment, events, transaction };
}
const input = { amount: '10', paidAt: '2026-11-01T05:00:00Z' };

describe('payment tenant context and transaction effects', () => {
  it.each([undefined, null, '', ' '])(
    'rejects a missing/blank tenant %s before starting a transaction',
    async (organizationId) => {
      const s = setup();
      await expect(s.service.create('d1', input, organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        s.service.createAutoAllocated(
          { ...input, type: 'RECEIVABLE', partyId: 'p1' },
          organizationId as never,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(s.service.list({}, organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      await expect(s.service.remove('pay-1', organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      expect(s.transaction).not.toHaveBeenCalled();
      expect(s.events.emit).not.toHaveBeenCalled();
    },
  );

  it('uses the explicit tenant for the lookup, voucher, debt update and success event', async () => {
    const s = setup();
    await s.service.create('d1', input, 'org-1', 'actor-1');
    expect(s.tx.debt.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'd1', organizationId: 'org-1' },
    });
    expect(s.tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1', createdById: 'actor-1' }),
      }),
    );
    expect(s.tx.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1', organizationId: 'org-1' } }),
    );
    expect(s.events.emit).toHaveBeenCalledWith(
      'audit.recorded',
      expect.objectContaining({ organizationId: 'org-1', actorId: 'actor-1' }),
    );
    expect(s.events.emit.mock.invocationCallOrder[0]).toBeGreaterThan(
      s.tx.debt.update.mock.invocationCallOrder[0],
    );
  });

  it('does not create or audit a voucher from a foreign-tenant debt', async () => {
    const s = setup();
    s.tx.debt.findFirstOrThrow.mockResolvedValue({ ...s.debt, organizationId: 'org-2' });
    await expect(s.service.create('d1', input, 'org-1')).rejects.toMatchObject({ status: 403 });
    expect(s.tx.payment.create).not.toHaveBeenCalled();
    expect(s.tx.debt.update).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });

  it('keeps auto-allocation in the supplied tenant', async () => {
    const s = setup();
    await s.service.createAutoAllocated({ ...input, type: 'RECEIVABLE', partyId: 'p1' }, 'org-1');
    expect(s.tx.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          partyId: 'p1',
          type: 'RECEIVABLE',
          status: { in: ['OPEN', 'PARTIAL'] },
        },
      }),
    );
    expect(s.tx.payment.create.mock.calls[0][0].data.organizationId).toBe('org-1');
  });

  it('checks reversal allocations before deleting or updating anything', async () => {
    const s = setup();
    s.tx.payment.findFirstOrThrow.mockResolvedValue({
      ...s.payment,
      allocations: [{ ...s.payment.allocations[0], debt: { ...s.debt, organizationId: 'org-2' } }],
    });
    await expect(s.service.remove('pay-1', 'org-1')).rejects.toMatchObject({ status: 403 });
    expect(s.tx.payment.delete).not.toHaveBeenCalled();
    expect(s.tx.debt.update).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });

  it('scopes successful reversal writes to the supplied tenant', async () => {
    const s = setup();
    await expect(s.service.remove('pay-1', 'org-1', 'actor-1')).resolves.toEqual({
      id: 'pay-1',
      restoredDebtCount: 1,
    });
    expect(s.tx.payment.delete).toHaveBeenCalledWith({
      where: { id: 'pay-1', organizationId: 'org-1' },
    });
    expect(s.tx.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1', organizationId: 'org-1' } }),
    );
  });

  it('does not publish success when a transaction write fails', async () => {
    const s = setup();
    s.tx.debt.update.mockRejectedValueOnce(new Error('write failed'));
    await expect(s.service.create('d1', input, 'org-1')).rejects.toThrow('write failed');
    expect(s.events.emit).not.toHaveBeenCalled();
  });
  it('uses a stable debt-ID tie-breaker when allocation priority dates are identical', async () => {
    const s = setup();
    await s.service.createAutoAllocated({ ...input, type: 'RECEIVABLE', partyId: 'p1' }, 'org-1');
    expect(s.tx.debt.findMany.mock.calls[0][0].orderBy).toEqual([
      { dueDate: 'asc' },
      { issueDate: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('rejects insufficient auto-allocation balance before any write or audit', async () => {
    const s = setup();
    await expect(
      s.service.createAutoAllocated(
        { ...input, amount: '80.01', type: 'RECEIVABLE', partyId: 'p1' },
        'org-1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(s.tx.payment.create).not.toHaveBeenCalled();
    expect(s.tx.debt.update).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });

  it('does not publish success if transaction completion fails after the callback writes', async () => {
    const s = setup();
    s.transaction.mockImplementation(async (run) => {
      await run(s.tx);
      throw new Error('commit failed');
    });
    await expect(s.service.create('d1', input, 'org-1')).rejects.toThrow('commit failed');
    expect(s.tx.payment.create).toHaveBeenCalledOnce();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
});

it('supports a fake repository without exposing any Prisma delegate to the application', async () => {
  const { debt, payment } = setup();
  const updateDebt = vi.fn().mockResolvedValue(undefined);
  const store = {
    findDebt: vi.fn().mockResolvedValue(debt),
    createPayment: vi.fn().mockResolvedValue(payment),
    updateDebt,
  };
  const order: string[] = [];
  const repository = {
    inTransaction: async (work: (value: typeof store) => Promise<unknown>) => {
      const result = await work(store);
      order.push('commit');
      return result;
    },
  };
  const events = { emit: vi.fn(() => order.push('audit')) };
  const service = new PaymentsService(repository as never, events as never);
  await service.create('d1', input, 'org-1', 'actor');
  expect(store.findDebt).toHaveBeenCalledWith('org-1', 'd1');
  expect(updateDebt).toHaveBeenCalledWith(
    'org-1',
    'd1',
    expect.objectContaining({ status: 'PARTIAL' }),
  );
  expect(order).toEqual(['commit', 'audit']);
});
