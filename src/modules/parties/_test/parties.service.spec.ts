import { PARTY_DEFAULT_SELECT } from '../infrastructure/queries/party.select.js';
import { PartyAuditAdapter } from '../infrastructure/party-audit.adapter.js';
import { PrismaPartiesRepository } from '../infrastructure/prisma-parties.repository.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { parseListQuery, getListQueryFieldNames } from '@common/query/index.js';
import { PartiesService } from '../application/parties.service.js';
import type { PartyWriteStore } from '../application/repositories/parties.repository.js';
import { PARTY_LIST_QUERY } from '../party.list-query.js';

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

  const rootRead = vi.fn(() => {
    throw new Error('List read outside snapshot');
  });
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi.fn();
  const tx = {
    party: { findMany, count, create },
    organizationMembership: { findFirst },
    debt: { groupBy },
    $queryRaw: queryRaw,
  };
  const transaction = vi.fn(async (run: (db: typeof tx) => unknown) => run(tx));
  const events = { emit: vi.fn() };
  const service = new PartiesService(
    new PrismaPartiesRepository({
      party: { findMany: rootRead, count: rootRead, create: rootRead },
      organizationMembership: { findFirst: rootRead },
      debt: { groupBy: rootRead },
      $queryRaw: rootRead,
      $transaction: transaction,
    } as never),
    new PartyAuditAdapter(events as never),
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

function transactionRepository(store: Partial<PartyWriteStore>) {
  return {
    inTransaction: vi.fn(async (work: (store: PartyWriteStore) => Promise<unknown>) =>
      work(store as PartyWriteStore),
    ),
  };
}

afterEach(() => vi.useRealTimers());

describe('PartiesService', () => {
  it('scopes the detail debt query and selects only the published scalar fields', async () => {
    const findFirstOrThrow = vi.fn().mockResolvedValue({
      id: 'p1',
      assignedTo: null,
      debts: [
        {
          id: 'd1',
          originalAmount: new Prisma.Decimal('10.25'),
          paidAmount: new Prisma.Decimal('2.5'),
        },
      ],
    });
    const repository = new PrismaPartiesRepository({ party: { findFirstOrThrow } } as never);
    const result = await repository.detail('org-1', 'p1');
    const { where, select } = findFirstOrThrow.mock.calls[0][0];
    expect(where).toEqual({ id: 'p1', organizationId: 'org-1' });
    expect(select.debts).toMatchObject({
      where: { organizationId: 'org-1' },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      select: { id: true, originalAmount: true, paidAmount: true },
    });
    expect(select.debts.select).not.toHaveProperty('items');
    expect(result.debts).toEqual([{ id: 'd1', originalAmount: '10.25', paidAmount: '2.5' }]);
  });

  it('reads only scalar fields for mutation snapshots', async () => {
    const findFirstOrThrow = vi.fn().mockResolvedValue({ id: 'p1' });
    const transaction = vi.fn(async (work) => work({ party: { findFirstOrThrow } }));
    const rootRead = vi.fn(() => {
      throw new Error('Read outside transaction');
    });
    const repository = new PrismaPartiesRepository({
      $transaction: transaction,
      party: { findFirstOrThrow: rootRead },
    } as never);
    await repository.inTransaction((store) => store.findRecord('org-1', 'p1'));
    expect(rootRead).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    const args = findFirstOrThrow.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'p1', organizationId: 'org-1' });
    expect(args.select).not.toHaveProperty('debts');
    expect(args.select).not.toHaveProperty('assignedTo');
  });

  it('updates without loading the detail debt history and preserves the audit snapshot', async () => {
    const before = { id: 'p1', name: 'Before', code: null, phone: null, taxCode: null };
    const after = { ...before, name: 'After' };
    const store = {
      findRecord: vi.fn().mockResolvedValue(before),
      update: vi.fn().mockResolvedValue(after),
    };
    const repository = transactionRepository(store);
    const events = { emit: vi.fn() };
    const service = new PartiesService(repository as never, new PartyAuditAdapter(events as never));
    expect(await service.update('org-1', 'p1', { name: 'After' }, 'actor-1')).toEqual(after);
    expect(store.findRecord).toHaveBeenCalledWith('org-1', 'p1');
    expect(events.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ before, after }),
    );
  });

  it('deactivates from a scalar snapshot and rejects parties with active debts', async () => {
    const before = { id: 'p1', name: 'Before' };
    const store = {
      findRecord: vi.fn().mockResolvedValue(before),
      countActiveDebts: vi.fn().mockResolvedValue(1),
      deactivate: vi.fn().mockResolvedValue(before),
    };
    const repository = transactionRepository(store);
    const events = { emit: vi.fn() };
    const service = new PartiesService(repository as never, new PartyAuditAdapter(events as never));
    await expect(service.deactivate('org-1', 'p1', 'actor-1')).rejects.toMatchObject({
      kind: 'invalid',
    });
    expect(store.deactivate).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
    store.countActiveDebts.mockResolvedValue(0);
    await service.deactivate('org-1', 'p1', 'actor-1');
    expect(store.deactivate).toHaveBeenCalledWith('org-1', 'p1');
  });

  it('uses only the scoped client for write-store reads, checks and writes', async () => {
    const find = vi.fn().mockResolvedValue({ id: 'p1' });
    const update = vi.fn().mockResolvedValue({ id: 'p1' });
    const count = vi.fn().mockResolvedValue(0);
    const member = vi.fn().mockResolvedValue({ id: 'member-1' });
    const rootAccess = vi.fn(() => {
      throw new Error('Access outside transaction');
    });
    const transaction = vi.fn(async (work) =>
      work({
        party: { findFirstOrThrow: find, update },
        debt: { count },
        organizationMembership: { findFirst: member },
      }),
    );
    const repository = new PrismaPartiesRepository({
      $transaction: transaction,
      party: { findFirstOrThrow: rootAccess, update: rootAccess },
      debt: { count: rootAccess },
      organizationMembership: { findFirst: rootAccess },
    } as never);
    await repository.inTransaction(async (store) => {
      await store.findRecord('org-1', 'p1');
      await store.hasActiveMember('org-1', 'user-1');
      await store.update('org-1', 'p1', { name: 'Updated' });
      await store.countActiveDebts('org-1', 'p1');
      await store.deactivate('org-1', 'p1');
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(find.mock.calls[0][0].where).toEqual({ id: 'p1', organizationId: 'org-1' });
    expect(member.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      organization: { status: 'ACTIVE' },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        partyId: 'p1',
        status: { notIn: ['PAID', 'CANCELLED'] },
      },
    });
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'p1', organizationId: 'org-1' },
      data: { name: 'Updated' },
      select: PARTY_DEFAULT_SELECT,
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'p1', organizationId: 'org-1' },
      data: { isActive: false },
      select: PARTY_DEFAULT_SELECT,
    });
    expect(rootAccess).not.toHaveBeenCalled();
  });

  it('recomputes searchText from fresh state after a conflict and audits only the committed attempt', async () => {
    const before = { id: 'p1', name: 'Before', code: 'old', phone: null, taxCode: null };
    const fresh = { ...before, code: 'fresh', creditLimit: null };
    const events = { emit: vi.fn() };
    const find = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(fresh);
    const update = vi.fn(async ({ data }) => ({ ...fresh, ...data }));
    let attempts = 0;
    const transaction = vi.fn(async (work) => {
      const result = await work({ party: { findFirstOrThrow: find, update } });
      expect(events.emit).not.toHaveBeenCalled();
      if (attempts++ === 0)
        throw new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2034',
          clientVersion: 'test',
        });
      return result;
    });
    const service = new PartiesService(
      new PrismaPartiesRepository({ $transaction: transaction } as never),
      new PartyAuditAdapter(events as never),
    );
    const result = await service.update('org-1', 'p1', { name: 'After' }, 'actor-1');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0].data.searchText).toContain('old');
    expect(update.mock.calls[1][0].data.searchText).toContain('fresh');
    expect(result).toMatchObject({ name: 'After', code: 'fresh' });
    expect(events.emit).toHaveBeenCalledOnce();
    expect(events.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ before: fresh, after: result }),
    );
  });

  it('checks a changed assignee in the write transaction and never writes or audits on rejection', async () => {
    const store = {
      findRecord: vi.fn().mockResolvedValue({ name: 'Party' }),
      hasActiveMember: vi.fn().mockResolvedValue(false),
      update: vi.fn(),
    };
    const events = { emit: vi.fn() };
    const service = new PartiesService(
      transactionRepository(store) as never,
      new PartyAuditAdapter(events as never),
    );
    await expect(
      service.update('org-1', 'p1', { assignedToId: 'foreign-user' }),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(store.hasActiveMember).toHaveBeenCalledWith('org-1', 'foreign-user');
    expect(store.update).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it.each(['create', 'update', 'deactivate'] as const)(
    'does not audit %s when commit fails',
    async (operation) => {
      const before = { id: 'p1', name: 'Before', code: null, phone: null, taxCode: null };
      const store = {
        create: vi.fn().mockResolvedValue(before),
        findRecord: vi.fn().mockResolvedValue(before),
        update: vi.fn().mockResolvedValue(before),
        countActiveDebts: vi.fn().mockResolvedValue(0),
        deactivate: vi.fn().mockResolvedValue(before),
      };
      const events = { emit: vi.fn() };
      const repository = {
        inTransaction: async (work: (store: PartyWriteStore) => Promise<unknown>) => {
          await work(store as never);
          throw new Error('commit failed');
        },
      };
      const service = new PartiesService(
        repository as never,
        new PartyAuditAdapter(events as never),
      );
      const request = {
        create: () => service.create('org-1', 'actor', { name: 'Party', type: 'CUSTOMER' }),
        update: () => service.update('org-1', 'p1', { name: 'After' }),
        deactivate: () => service.deactivate('org-1', 'p1'),
      }[operation]();
      await expect(request).rejects.toThrow('commit failed');
      expect(events.emit).not.toHaveBeenCalled();
    },
  );

  it('checks active party ownership through its repository contract', async () => {
    const isActive = vi.fn().mockResolvedValue(true);
    const service = new PartiesService({ isActive } as never, {} as never);
    await service.assertActive('org-1', 'p1');
    expect(isActive).toHaveBeenCalledWith('org-1', 'p1');
    isActive.mockResolvedValue(false);
    await expect(service.assertActive('org-1', 'foreign')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
  it.each(
    getListQueryFieldNames(PARTY_LIST_QUERY, 'sortable')
      .filter((field) => !PARTY_LIST_QUERY.fields[field].computed)
      .flatMap((field) => ['asc', 'desc'].map((direction) => ({ field, direction }))),
  )(
    'keeps ordinary $field $direction sorting on paginated Prisma reads',
    async ({ field, direction }) => {
      const s = setup();
      await s.service.list(
        'org-1',
        { page: 2, pageSize: 1 },
        parseListQuery({ sortBy: field, sortOrder: direction }, PARTY_LIST_QUERY).options,
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
      parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY).options,
    );
    expect(result.items.map(({ id }) => id)).toEqual(['p2']);
    expect(result.total).toBe(3);
    expect(s.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true, id: { in: ['p2'] } },
      select: expect.any(Object),
    });
    const sql = s.queryRaw.mock.calls[0][0] as Prisma.Sql;
    const bounds = sql.text.match(/LIMIT \$(\d+) OFFSET \$(\d+)/)!;
    expect(bounds.slice(1).map((index) => sql.values[Number(index) - 1])).toEqual([1, 1]);
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
      parseListQuery({ sortBy: 'outstandingDocuments', sortOrder: 'desc' }, PARTY_LIST_QUERY)
        .options,
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
      parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY).options,
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
      select: { _count: { select: { debts: { where: { organizationId: 'org-1' } } } } },
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
        parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY).options,
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
        parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY).options,
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
      { createdRange: 'today', createdFrom: '2026-10-31', createdTo: '2026-10-31' },
      parseListQuery({ sortBy: 'receivable' }, PARTY_LIST_QUERY).options,
    );
    expect(s.count.mock.calls[0][0].where.createdAt).toEqual({
      gte: new Date('2026-10-30T17:00:00Z'),
      lte: new Date('2026-10-31T16:59:59.999Z'),
    });
  });

  it.each([
    ['today', '2028-02-28T17:00:00.000Z', '2028-02-29T16:59:59.999Z'],
    ['last_7_days', '2028-02-22T17:00:00.000Z', '2028-02-29T16:59:59.999Z'],
    ['this_month', '2028-01-31T17:00:00.000Z', '2028-02-29T16:59:59.999Z'],
  ] as const)('bounds the %s preset by Vietnam calendar dates', async (createdRange, from, to) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-02-28T18:00:00Z'));
    const s = setup();

    await s.service.list('org-1', { createdRange });

    const where = {
      organizationId: 'org-1',
      isActive: true,
      createdAt: {
        gte: new Date(from),
        lte: new Date(to),
      },
    };
    expect(s.count).toHaveBeenCalledWith({ where });
    expect(s.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it('uses a one-sided explicit bound in place of the preset', async () => {
    const s = setup();
    await s.service.list('org-1', { createdRange: 'this_month', createdTo: '2028-02-29' });

    expect(s.count.mock.calls[0][0].where.createdAt).toEqual({
      lte: new Date('2028-02-29T16:59:59.999Z'),
    });
  });

  it('rejects reversed ranges and impossible dates before database access', async () => {
    const s = setup();
    for (const query of [
      { createdFrom: '2026-02-30' },
      { createdFrom: '2026-11-01', createdTo: '2026-10-31' },
    ]) {
      await expect(s.service.list('org-1', query)).rejects.toMatchObject({
        kind: 'invalid',
        key: 'parties.INVALID_DATE_RANGE',
      });
    }
    expect(s.findMany).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', ' '])(
    'rejects missing tenant %s before party queries or mutations',
    async (organizationId) => {
      const s = setup();
      await expect(s.service.list(organizationId as never, {})).rejects.toMatchObject({
        kind: 'forbidden',
      });
      expect(() => s.service.detail(organizationId as never, 'p1')).toThrow();
      await expect(
        s.service.create(organizationId as never, 'actor', { name: 'Party', type: 'CUSTOMER' }),
      ).rejects.toMatchObject({ kind: 'forbidden' });
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
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(s.findFirst.mock.calls[0][0].where).toEqual({
      organizationId: 'org-1',
      userId: 'foreign-user',
      status: 'ACTIVE',
      user: { status: 'ACTIVE' },
      organization: { status: 'ACTIVE' },
    });
    expect(s.create).not.toHaveBeenCalled();
    expect(s.rootRead).not.toHaveBeenCalled();
    expect(s.events.emit).not.toHaveBeenCalled();
  });
});

it('runs the create use case with plain ports and audits only its successful result', async () => {
  const party = { id: 'party-plain', name: 'Plain', creditLimit: '0' };
  const create = vi.fn().mockResolvedValue(party);
  const record = vi.fn();
  const hasActiveMember = vi.fn().mockResolvedValue(true);
  const service = new PartiesService(transactionRepository({ create, hasActiveMember }) as never, {
    record,
  });
  const result = await service.create('org-plain', 'actor-plain', {
    type: 'CUSTOMER',
    name: ' Plain ',
    assignedToId: 'member-plain',
    creditLimit: '0',
  });
  expect(hasActiveMember).toHaveBeenCalledWith('org-plain', 'member-plain');
  expect(create).toHaveBeenCalledWith(
    'org-plain',
    'actor-plain',
    expect.objectContaining({
      type: 'CUSTOMER',
      name: 'Plain',
      searchText: 'plain',
      creditLimit: '0',
    }),
  );
  expect(result).toBe(party);
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'party.created',
      organizationId: 'org-plain',
      actorId: 'actor-plain',
      after: party,
    }),
  );
  record.mockClear();
  create.mockRejectedValueOnce(new Error('write failed'));
  await expect(
    service.create('org-plain', 'actor-plain', { type: 'CUSTOMER', name: 'Plain' }),
  ).rejects.toThrow('write failed');
  expect(record).not.toHaveBeenCalled();
});

it('converts Prisma money into exact application values at the adapter boundary', async () => {
  const stored = { id: 'p1', creditLimit: new Prisma.Decimal('9999999999999999.99') };
  const create = vi.fn().mockResolvedValue(stored);
  const transaction = vi.fn(async (work) => work({ party: { create } }));
  const repository = new PrismaPartiesRepository({ $transaction: transaction } as never);
  const result = await repository.inTransaction((store) =>
    store.create('org-1', 'actor-1', {
      type: 'CUSTOMER',
      name: 'Exact',
      searchText: 'exact',
      creditLimit: '9999999999999999.99',
    }),
  );
  expect(result.creditLimit).toBe('9999999999999999.99');
  expect(stored.creditLimit).toBeInstanceOf(Prisma.Decimal);
  expect(create).toHaveBeenCalledWith({
    data: {
      organizationId: 'org-1',
      createdById: 'actor-1',
      type: 'CUSTOMER',
      name: 'Exact',
      searchText: 'exact',
      creditLimit: '9999999999999999.99',
    },
    select: PARTY_DEFAULT_SELECT,
  });
});
