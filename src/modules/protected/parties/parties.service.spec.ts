import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma';
import { parseListQuery } from '@common/query';
import { PartiesService } from './parties.service';
import { PARTY_LIST_QUERY } from './parties.list-query';

function setup() {
  const findMany = vi.fn().mockResolvedValue([
    { id: 'p1', name: 'Same', code: 'B', _count: { debts: 1 } },
    { id: 'p2', name: 'Same', code: 'A', _count: { debts: 2 } },
    { id: 'p3', name: 'Other', code: 'C', _count: { debts: 1 } },
  ]);
  const groupBy = vi.fn().mockResolvedValue([
    {
      partyId: 'p1',
      type: 'RECEIVABLE',
      _sum: { originalAmount: new Prisma.Decimal('100'), paidAmount: new Prisma.Decimal('0') },
    },
    {
      partyId: 'p2',
      type: 'RECEIVABLE',
      _sum: { originalAmount: new Prisma.Decimal('200'), paidAmount: new Prisma.Decimal('100') },
    },
    {
      partyId: 'p3',
      type: 'RECEIVABLE',
      _sum: { originalAmount: new Prisma.Decimal('200'), paidAmount: new Prisma.Decimal('0') },
    },
  ]);
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi.fn();
  const events = { emit: vi.fn() };
  const service = new PartiesService(
    {
      party: { findMany, create },
      debt: { groupBy },
      organizationMembership: { findFirst },
    } as never,
    events as never,
  );
  return { service, findMany, groupBy, findFirst, create, events };
}

afterEach(() => vi.useRealTimers());

describe('PartiesService', () => {
  it('applies secondary sort keys before paginating computed balances', async () => {
    const s = setup();
    const result = await s.service.list(
      'org-1',
      { page: 2, pageSize: 1 },
      parseListQuery({ sort: '-receivable,code' }, PARTY_LIST_QUERY),
    );
    expect(result.items.map((p) => p.id)).toEqual(['p2']);
    expect(result.total).toBe(3);
    expect(s.findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-1',
      isActive: true,
    });
    expect(s.groupBy.mock.calls[0][0].where.organizationId).toBe('org-1');
  });

  it('honors fields preceding a computed key and more than one computed key', async () => {
    const s = setup();
    const result = await s.service.list(
      'org-1',
      {},
      parseListQuery({ sort: 'name,-receivable,payable' }, PARTY_LIST_QUERY),
    );
    expect(result.items.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('uses a unique id tie-breaker when every requested value is equal', async () => {
    const s = setup();
    s.findMany.mockResolvedValue([...(await s.findMany())].reverse());
    const result = await s.service.list(
      'org-1',
      {},
      parseListQuery({ sort: '-receivable' }, PARTY_LIST_QUERY),
    );
    expect(result.items.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('uses Vietnam day boundaries for explicit dates regardless of server timezone', async () => {
    const s = setup();
    await s.service.list(
      'org-1',
      { createdFrom: '2026-10-31', createdTo: '2026-10-31' },
      parseListQuery({ sort: 'receivable' }, PARTY_LIST_QUERY),
    );
    expect(s.findMany.mock.calls[0][0].where.createdAt).toEqual({
      gte: new Date('2026-10-30T17:00:00Z'),
      lte: new Date('2026-10-31T16:59:59.999Z'),
    });
  });

  it('rejects reversed ranges and impossible dates before database access', async () => {
    const s = setup();
    for (const query of [
      { createdFrom: '2026-02-30' },
      { createdFrom: '2026-11-01', createdTo: '2026-10-31' },
    ]) {
      await expect(s.service.list('org-1', query)).rejects.toMatchObject({ status: 400 });
    }
    expect(s.findMany).not.toHaveBeenCalled();
  });

  it('rejects an assignee outside the active tenant membership and never writes or audits', async () => {
    const s = setup();
    await expect(
      s.service.create('org-1', 'actor', {
        name: 'Party',
        type: 'CUSTOMER',
        assignedToId: 'foreign-user',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(s.findFirst.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      userId: 'foreign-user',
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
    });
    expect(s.create).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
});
