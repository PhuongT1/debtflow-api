import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { parseListQuery, validFieldsOf } from '@common/query/index.js';
import { PartiesService } from './parties.service.js';
import { OrganizationMembersService } from '@modules/users/services/organization-members.service.js';
import { PARTY_LIST_QUERY } from '../queries/parties.list-query.js';

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
      _sum: { originalAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(0) },
    },
    {
      partyId: 'p2',
      type: 'RECEIVABLE',
      _sum: { originalAmount: new Prisma.Decimal(200), paidAmount: new Prisma.Decimal(100) },
    },
  ]);
  const queryRaw = vi
    .fn()
    .mockResolvedValue([
      { id: 'p2', receivable: new Prisma.Decimal(100), payable: new Prisma.Decimal(0) },
    ]);
  const count = vi.fn().mockResolvedValue(3);
  const tx = { party: { findMany, count }, debt: { groupBy }, $queryRaw: queryRaw };
  const transaction = vi.fn(async (run: (db: typeof tx) => unknown) => run(tx));
  const rootRead = vi.fn(() => {
    throw new Error('List read outside snapshot');
  });
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi.fn();
  const events = { emit: vi.fn() };
  const service = new PartiesService(
    {
      party: { findMany: rootRead, count: rootRead, create },
      debt: { groupBy: rootRead },
      $queryRaw: rootRead,
      $transaction: transaction,
    } as never,
    events as never,
    new OrganizationMembersService({ organizationMembership: { findFirst } } as never),
  );
  return {
    service,
    findMany,
    count,
    groupBy,
    queryRaw,
    transaction,
    rootRead,
    findFirst,
    create,
    events,
  };
}

afterEach(() => vi.useRealTimers());

describe('PartiesService', () => {
  it('checks an active party in the caller tenant using the supplied transaction', async () => {
    const s = setup();
    const findFirst = vi.fn().mockResolvedValue({ id: 'p1' });
    const tx = { party: { findFirst } };
    await s.service.assertActive('org-1', 'p1', tx as never);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'p1', organizationId: 'org-1', isActive: true },
      select: { id: true },
    });
    findFirst.mockResolvedValue(null);
    await expect(
      s.service.assertActive('org-1', 'foreign-or-inactive', tx as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(s.create).not.toHaveBeenCalled();
  });
  it.each(
    validFieldsOf(PARTY_LIST_QUERY, 'sortable')
      .filter((field) => !PARTY_LIST_QUERY.fields[field].computed)
      .flatMap((field) => ['asc', 'desc'].map((direction) => ({ field, direction }))),
  )(
    'keeps ordinary $field $direction sorting on paginated Prisma reads',
    async ({ field, direction }) => {
      const s = setup();
      await s.service.list(
        'org-1',
        { page: 2, pageSize: 1 },
        parseListQuery({ sortBy: field, sortOrder: direction }, PARTY_LIST_QUERY),
      );
      expect(s.queryRaw).not.toHaveBeenCalled();
      expect(s.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ [field]: direction }, { id: 'asc' }],
          skip: 1,
          take: 1,
        }),
      );
    },
  );

  it('asks SQL for one globally sorted page and hydrates only its IDs', async () => {
    const s = setup();
    const result = await s.service.list(
      'org-1',
      { page: 2, pageSize: 1 },
      parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY),
    );
    expect(result.items.map(({ id }) => id)).toEqual(['p2']);
    expect(result.total).toBe(3);
    expect(s.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true, id: { in: ['p2'] } },
      include: expect.any(Object),
    });
    const sql = s.queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values.slice(-2)).toEqual([1, 1]);
    expect(s.groupBy).not.toHaveBeenCalled();
    expect(s.rootRead).not.toHaveBeenCalled();
    expect(s.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });

  it('routes document-count sorting through the tenant-scoped aggregate query', async () => {
    const s = setup();
    await s.service.list(
      'org-1',
      {},
      parseListQuery({ sortBy: 'outstandingDocuments', sortOrder: 'desc' }, PARTY_LIST_QUERY),
    );
    expect(s.queryRaw).toHaveBeenCalledOnce();
    expect((s.queryRaw.mock.calls[0][0] as Prisma.Sql).text).toContain('COUNT(*)');
    expect(s.groupBy).not.toHaveBeenCalled();
  });

  it('retains database ordering even when the detail lookup returns rows in another order', async () => {
    const s = setup();
    s.queryRaw.mockResolvedValue([
      {
        id: 'p3',
        receivable: new Prisma.Decimal('9007199254740993.25'),
        payable: new Prisma.Decimal(0),
      },
      { id: 'p1', receivable: new Prisma.Decimal(100), payable: new Prisma.Decimal(0) },
    ]);
    const result = await s.service.list(
      'org-1',
      {},
      parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY),
    );
    expect(result.items.map(({ id }) => id)).toEqual(['p3', 'p1']);
    expect(result.items[0].balance.receivable.toString()).toBe('9007199254740993.25');
  });

  it('keeps ordinary pagination and balance reads inside the same snapshot', async () => {
    const s = setup();
    s.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    const result = await s.service.list('org-1', { page: 1, pageSize: 2 });
    expect(s.queryRaw).not.toHaveBeenCalled();
    expect(s.findMany.mock.calls[0][0]).toMatchObject({
      skip: 0,
      take: 2,
      where: { organizationId: 'org-1' },
      include: { _count: { select: { debts: { where: { organizationId: 'org-1' } } } } },
    });
    expect(s.groupBy.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-1',
      partyId: { in: ['p1', 'p2'] },
    });
    expect(result.items[1].balance.receivable.toString()).toBe('100');
    expect(s.rootRead).not.toHaveBeenCalled();
  });

  it.each([0, 3])(
    'returns the exact total %s for an empty/out-of-range page without aggregating',
    async (total) => {
      const s = setup();
      s.count.mockResolvedValue(total);
      const result = await s.service.list(
        'org-1',
        { page: 99, pageSize: 20 },
        parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY),
      );
      expect(result).toMatchObject({ items: [], total, page: 99 });
      expect(s.queryRaw).not.toHaveBeenCalled();
      expect(s.findMany).not.toHaveBeenCalled();
      expect(s.groupBy).not.toHaveBeenCalled();
    },
  );

  it('fails instead of silently losing a ranked row that cannot be hydrated', async () => {
    const s = setup();
    s.findMany.mockResolvedValue([]);
    await expect(
      s.service.list(
        'org-1',
        {},
        parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY),
      ),
    ).rejects.toThrow('snapshot is inconsistent');
  });

  it('propagates a failed count without returning a partial successful response', async () => {
    const s = setup();
    s.count.mockRejectedValue(new Error('read failed'));
    await expect(s.service.list('org-1', {})).rejects.toThrow('read failed');
    expect(s.queryRaw).not.toHaveBeenCalled();
    expect(s.findMany).not.toHaveBeenCalled();
  });

  it('uses Vietnam day boundaries for explicit dates regardless of server timezone', async () => {
    const s = setup();
    await s.service.list(
      'org-1',
      { createdFrom: '2026-10-31', createdTo: '2026-10-31' },
      parseListQuery({ sortBy: 'receivable' }, PARTY_LIST_QUERY),
    );
    expect(s.count.mock.calls[0][0].where.createdAt).toEqual({
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

  it.each([undefined, null, '', ' '])(
    'rejects missing tenant %s before party queries or mutations',
    async (organizationId) => {
      const s = setup();
      await expect(s.service.list(organizationId as never, {})).rejects.toMatchObject({
        status: 403,
      });
      expect(() => s.service.detail(organizationId as never, 'p1')).toThrow();
      await expect(
        s.service.create(organizationId as never, 'actor', { name: 'Party', type: 'CUSTOMER' }),
      ).rejects.toMatchObject({ status: 403 });
      expect(s.findMany).not.toHaveBeenCalled();
      expect(s.create).not.toHaveBeenCalled();
      expect(s.events.emit).not.toHaveBeenCalled();
    },
  );

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
      organization: { status: 'ACTIVE' },
    });
    expect(s.create).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
});
