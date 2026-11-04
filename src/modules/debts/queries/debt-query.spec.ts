import { describe, expect, it, vi } from 'vitest';
import { parseListQuery } from '@common/query';
import { buildDebtQuery } from './debt-query';
import { DEBT_LIST_QUERY } from './debts.list-query';

describe('debt filter composition', () => {
  it('preserves tenant scope when a client ORs filters and combines business filters', () => {
    const parsed = parseListQuery(
      { 'filter[code][eq]': 'CN-1', 'filter[partyId][eq]': 'p1', filterOperator: 'OR' },
      DEBT_LIST_QUERY,
    );
    const result = buildDebtQuery(
      'org-1',
      { type: 'RECEIVABLE', provinceCode: 'HCM', assignedToId: 'u1' },
      parsed,
    );
    expect(result.where).toEqual({
      AND: [
        {
          organizationId: 'org-1',
          type: 'RECEIVABLE',
          party: { provinceCode: 'HCM' },
          assignedToId: 'u1',
        },
        parsed.where,
      ],
    });
  });

  it('retains Vietnam date-only boundaries for the shared list/report filter', () => {
    const { where } = buildDebtQuery('org-1', { dueDate: '2026-11-01' });
    expect(where).toEqual({
      organizationId: 'org-1',
      AND: [
        {
          dueDate: {
            gte: new Date('2026-10-31T17:00:00.000Z'),
            lte: new Date('2026-11-01T16:59:59.999Z'),
          },
        },
      ],
    });
  });

  it('uses a unique tie-breaker for default paging with a single explicit field', () => {
    expect(buildDebtQuery('org-1', {}).orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(buildDebtQuery('org-1', { overdue: 'true' }).orderBy).toEqual([
      { dueDate: 'asc' },
      { id: 'asc' },
    ]);
    const parsed = parseListQuery({ sortBy: 'dueDate', sortOrder: 'desc' }, DEBT_LIST_QUERY);
    expect(buildDebtQuery('org-1', {}, parsed).orderBy).toEqual(parsed.orderBy);
  });

  it('keeps overdue, exact-date and explicit status constraints instead of overwriting them', () => {
    const result = buildDebtQuery(
      'org-1',
      {
        status: 'PAID',
        outstanding: 'true',
        overdue: 'true',
        dueDate: '2026-11-03',
      },
      undefined,
      new Date('2026-11-01T05:00:00Z'),
    );
    expect(result.where).toEqual({
      organizationId: 'org-1',
      status: 'PAID',
      AND: [
        { dueDate: { lt: new Date('2026-10-31T17:00:00Z') } },
        {
          dueDate: {
            gte: new Date('2026-11-02T17:00:00Z'),
            lte: new Date('2026-11-03T16:59:59.999Z'),
          },
        },
        { status: { in: ['OPEN', 'PARTIAL'] } },
      ],
    });
  });

  it('keeps product filters within one related item and text search within the tenant scope', () => {
    const result = buildDebtQuery('org-1', {
      categoryId: 'cat',
      brandId: 'brand',
      productId: 'product',
      provinceCode: 'HCM',
      q: 'shop',
    });
    expect(result.where).toMatchObject({
      organizationId: 'org-1',
      party: { provinceCode: 'HCM' },
      items: { some: { product: { categoryId: 'cat', brandId: 'brand', id: 'product' } } },
      OR: expect.arrayContaining([{ party: { name: { contains: 'shop', mode: 'insensitive' } } }]),
    });
  });

  it.each([
    { dueDate: '2026-02-30' },
    { dueDateFrom: '2026-11-03', dueDateTo: '2026-11-01' },
    { dueDateTo: 'not-a-date' },
  ])('rejects invalid or reversed date filters rather than silently dropping them: %j', (query) => {
    expect(() => buildDebtQuery('org-1', query)).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('builds this-month boundaries in Vietnam independently of the server timezone', () => {
    vi.stubEnv('TZ', 'America/New_York');
    try {
      const result = buildDebtQuery(
        'org-1',
        { dueRange: 'this_month' },
        undefined,
        new Date('2026-10-31T18:00:00Z'),
      );
      expect(result.where).toMatchObject({
        AND: [
          {
            dueDate: {
              gte: new Date('2026-10-31T17:00:00Z'),
              lte: new Date('2026-11-30T16:59:59.999Z'),
            },
          },
        ],
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
