import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { DashboardService } from './dashboard.service.js';

function setup() {
  const prisma = {
    debt: {
      groupBy: vi.fn().mockResolvedValue([
        {
          type: 'RECEIVABLE',
          _sum: {
            originalAmount: new Prisma.Decimal('9007199254740993.25'),
            paidAmount: new Prisma.Decimal('0.05'),
          },
        },
      ]),
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const actionCenter = { get: vi.fn().mockResolvedValue({}) };
  return {
    prisma,
    actionCenter,
    service: new DashboardService(prisma as never, actionCenter as never),
  };
}
afterEach(() => vi.useRealTimers());

describe('dashboard database summaries', () => {
  it('aggregates monetary totals without loading all debts, preserving exact Decimal and empty groups', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T05:00:00Z'));
    const s = setup();
    const result = await s.service.get({}, 'org-1');
    expect(result.receivable.remaining.toString()).toBe('9007199254740993.2');
    expect(result.payable.remaining.toString()).toBe('0');
    expect(result.overdueCount).toBe(2);
    expect(s.prisma.debt.groupBy.mock.calls[0][0]).toMatchObject({
      by: ['type'],
      where: { organizationId: 'org-1', status: { not: 'CANCELLED' } },
    });
    expect(s.prisma.debt.count.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      status: { in: ['OPEN', 'PARTIAL'] },
      dueDate: { lt: new Date('2026-10-31T17:00:00Z') },
    });
    expect(s.prisma.debt.findMany).toHaveBeenCalledOnce();
    expect(s.prisma.debt.findMany.mock.calls[0][0]).toMatchObject({
      take: 8,
      where: { organizationId: 'org-1' },
    });
  });
  it('uses shared Vietnam date boundaries for recent payments', async () => {
    const s = setup();
    await s.service.get({ dateFrom: '2026-11-01', dateTo: '2026-11-02' }, 'org-1');
    expect(s.prisma.payment.findMany.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      paidAt: { gte: new Date('2026-10-31T17:00:00Z'), lte: new Date('2026-11-02T16:59:59.999Z') },
    });
  });
  it.each([
    { dateFrom: '2026-02-30' },
    { dateFrom: '2026-11-03', dateTo: '2026-11-01' },
    { dateFrom: '2026-11-01T05:00:00Z' },
  ])('rejects invalid periods before querying: %j', async (query) => {
    const s = setup();
    await expect(s.service.get(query, 'org-1')).rejects.toMatchObject({ status: 400 });
    expect(s.prisma.debt.groupBy).not.toHaveBeenCalled();
    expect(s.actionCenter.get).not.toHaveBeenCalled();
  });
  it('requires tenant context before invoking domain queries', async () => {
    const s = setup();
    await expect(s.service.get({}, undefined as never)).rejects.toMatchObject({ status: 403 });
    expect(s.actionCenter.get).not.toHaveBeenCalled();
  });
});
