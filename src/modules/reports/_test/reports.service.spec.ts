import { PrismaReportsRepository } from '../infrastructure/prisma-reports.repository.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtStatus, Prisma } from '@generated/prisma/client.js';
import { parseListQuery } from '@common/query/index.js';
import { DEBT_LIST_QUERY } from '@modules/debts/queries/debts.list-query.js';
import { ReportsService } from '../reports.service.js';

const now = new Date('2026-11-01T05:00:00Z');
const day = 86_400_000;
const due = (days: number) => new Date(new Date('2026-10-31T17:00:00Z').getTime() - days * day);
type Row = {
  organizationId: string;
  status: DebtStatus;
  dueDate: Date;
  originalAmount: string;
  paidAmount: string;
};

function setup(rows: Row[] = []) {
  // A bounded fixture evaluator for the three clauses this report sends to aggregate.
  // Query-shape assertions below cover composed client filters; this does not emulate PostgreSQL.
  const aggregate = vi.fn((args: Prisma.DebtAggregateArgs) => {
    const [scope, status, range] = args.where!.AND as Prisma.DebtWhereInput[];
    const active = status.status as Prisma.EnumDebtStatusFilter;
    const dates = range.dueDate as Prisma.DateTimeFilter;
    const selected = rows.filter(
      (row) =>
        row.organizationId === scope.organizationId &&
        (active.in as DebtStatus[]).includes(row.status) &&
        (!dates.gte || row.dueDate >= new Date(dates.gte as Date)) &&
        (!dates.lt || row.dueDate < new Date(dates.lt as Date)) &&
        (!dates.gt || row.dueDate > new Date(dates.gt as Date)) &&
        (!dates.lte || row.dueDate <= new Date(dates.lte as Date)),
    );
    return Promise.resolve({
      _count: { _all: selected.length },
      _sum: {
        originalAmount: selected.length
          ? selected.reduce((sum, row) => sum.plus(row.originalAmount), new Prisma.Decimal(0))
          : null,
        paidAmount: selected.length
          ? selected.reduce((sum, row) => sum.plus(row.paidAmount), new Prisma.Decimal(0))
          : null,
      },
    });
  });
  const transaction = vi.fn((queries: Promise<unknown>[]) => Promise.all(queries));
  const service = new ReportsService(
    new PrismaReportsRepository({ debt: { aggregate }, $transaction: transaction } as never),
  );
  return { service, aggregate, transaction };
}

describe('full-dataset aging report', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it('counts more than 1000 debts without pagination and excludes other tenants and terminal states', async () => {
    const row: Row = {
      organizationId: 'org-1',
      status: 'PARTIAL',
      dueDate: due(4),
      originalAmount: '100.10',
      paidAmount: '0.05',
    };
    const s = setup([
      ...Array.from({ length: 1501 }, () => ({ ...row })),
      { ...row, organizationId: 'org-2', originalAmount: '99999' },
      { ...row, status: 'PAID' },
      { ...row, status: 'CANCELLED' },
    ]);
    const result = await s.service.aging({ page: 99, pageSize: 1 }, 'org-1');
    expect(result.day1To7).toEqual({ label: 'Quá hạn 1-7 ngày', amount: '150175.05', count: 1501 });
    expect(result.notDue).toMatchObject({ amount: '0', count: 0 });
    expect(s.aggregate).toHaveBeenCalledTimes(5);
    for (const [args] of s.aggregate.mock.calls) {
      expect(args).not.toHaveProperty('skip');
      expect(args).not.toHaveProperty('take');
      expect(args).not.toHaveProperty('orderBy');
    }
    expect(s.transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: 'RepeatableRead',
    });
  });

  it('uses Vietnam calendar-day boundaries, future dates and exact Decimal amounts', async () => {
    const dates = [
      due(-2),
      due(0),
      new Date(due(0).getTime() + 1),
      due(1),
      due(7),
      due(8),
      due(30),
      due(31),
      due(60),
      due(61),
    ];
    const s = setup(
      dates.map((dueDate, index) => ({
        organizationId: 'org-1',
        status: 'PARTIAL',
        dueDate,
        originalAmount: index === 9 ? '9999999999999999.99' : '10.20',
        paidAmount: '0.10',
      })),
    );
    const result = await s.service.aging({}, 'org-1');
    expect(Object.values(result).map((bucket) => bucket.count)).toEqual([3, 2, 2, 2, 1]);
    expect(Object.values(result).map((bucket) => bucket.amount)).toEqual([
      '30.3',
      '20.2',
      '20.2',
      '20.2',
      '9999999999999999.89',
    ]);
  });

  it('ANDs client OR filters and bucket restrictions with the trusted tenant and legacy filters', async () => {
    const s = setup();
    const listQuery = parseListQuery(
      {
        'filter[partyId][eq]': 'party-1',
        'filter[code][eq]': 'CN-1',
        filterOperator: 'OR',
        sortBy: 'dueDate',
        sortOrder: 'desc',
      },
      DEBT_LIST_QUERY,
    );
    await s.service.aging({ type: 'RECEIVABLE', assignedToId: 'user-1' }, 'org-1', listQuery);
    for (const [args] of s.aggregate.mock.calls) {
      expect(args.where!.AND).toEqual([
        {
          AND: [
            { organizationId: 'org-1', type: 'RECEIVABLE', assignedToId: 'user-1' },
            listQuery.where,
          ],
        },
        { status: { in: ['OPEN', 'PARTIAL'] } },
        { dueDate: expect.any(Object) },
      ]);
    }
  });

  it.each([undefined, null, '', '  '])(
    'fails before any query when the tenant is %s',
    async (organizationId) => {
      const s = setup();
      await expect(s.service.aging({}, organizationId as never)).rejects.toMatchObject({
        status: 403,
      });
      expect(s.aggregate).not.toHaveBeenCalled();
      expect(s.transaction).not.toHaveBeenCalled();
    },
  );

  it('propagates a failed aggregate instead of returning an empty successful report', async () => {
    const s = setup();
    s.transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(s.service.aging({}, 'org-1')).rejects.toThrow('database unavailable');
  });
});
