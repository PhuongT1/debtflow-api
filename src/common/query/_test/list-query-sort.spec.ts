import { describe, expect, it } from 'vitest';
import { buildPrismaOrderBy, parseSortParams } from '../list-query-sort.js';
import { parseListQuery, applyListQuery } from '../list-query-builder.js';
import { errorOf, TEST_CONFIG } from './test-config.js';

describe('parseSortParams', () => {
  it('returns an empty list when nothing is requested', () => {
    expect(parseSortParams({}, TEST_CONFIG)).toEqual([]);
    expect(parseSortParams({ sortBy: '' }, TEST_CONFIG)).toEqual([]);
  });

  it('parses sortBy + sortOrder and defaults to asc', () => {
    expect(parseSortParams({ sortBy: 'code', sortOrder: 'DESC' }, TEST_CONFIG)).toEqual([
      { field: 'code', direction: 'desc' },
    ]);
    expect(parseSortParams({ sortBy: 'code' }, TEST_CONFIG)).toEqual([
      { field: 'code', direction: 'asc' },
    ]);
  });

  it('rejects inherited object properties as sort fields', () => {
    for (const sortBy of ['constructor', 'toString', '__proto__']) {
      expect(errorOf(() => parseSortParams({ sortBy }, TEST_CONFIG)).code).toBe('INVALID_SORT');
    }
  });

  it('rejects unknown and non-sortable fields and lists the valid ones', () => {
    const unknown = errorOf(() => parseSortParams({ sortBy: 'organizationId' }, TEST_CONFIG));
    expect(unknown.code).toBe('INVALID_SORT');
    expect(unknown.params?.field).toBe('organizationId');
    expect(String(unknown.params?.validFields)).toContain('dueDate');
    expect(String(unknown.params?.validFields)).not.toContain('secret');

    expect(errorOf(() => parseSortParams({ sortBy: 'secret' }, TEST_CONFIG)).code).toBe(
      'INVALID_SORT',
    );
  });

  it.each(['up', '', ['desc'], { value: 'desc' }])(
    'rejects invalid/repeated sortOrder %j',
    (sortOrder) => {
      expect(errorOf(() => parseSortParams({ sortBy: 'code', sortOrder }, TEST_CONFIG)).code).toBe(
        'INVALID_SORT_ORDER',
      );
    },
  );
  it.each(['code,amount', '-code', ['code'], ['code', 'amount'], { field: 'code' }])(
    'rejects multi-field or non-scalar sortBy %j',
    (sortBy) => {
      expect(errorOf(() => parseSortParams({ sortBy }, TEST_CONFIG)).code).toBe('INVALID_SORT');
    },
  );
});

describe('buildPrismaOrderBy', () => {
  it.each(['dueDate', 'createdAt', 'code', 'status', 'amount', 'quantity', 'isActive', 'note'])(
    'reuses the same parser/builder for %s in both directions',
    (field) => {
      for (const direction of ['asc', 'desc'] as const) {
        const parsed = parseListQuery({ sortBy: field, sortOrder: direction }, TEST_CONFIG);
        expect(parsed.sort).toEqual([{ field, direction }]);
        expect(parsed.orderBy).toEqual([{ [field]: direction }, { id: 'asc' }]);
        const applied = applyListQuery(parsed, {
          where: { organizationId: 'org-1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        });
        expect(applied.where).toEqual({ organizationId: 'org-1' });
        expect(applied.orderBy).toEqual(parsed.orderBy);
      }
    },
  );

  it('retains the endpoint default ordering when no sort is requested', () => {
    const base = {
      where: { organizationId: 'org-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    };
    expect(applyListQuery(parseListQuery({}, TEST_CONFIG), base)).toEqual(base);
  });

  it('maps fields, nests relation paths and appends the id tie-breaker', () => {
    const orderBy = buildPrismaOrderBy([{ field: 'partyName', direction: 'desc' }], TEST_CONFIG);

    expect(orderBy).toEqual([{ party: { name: 'desc' } }, { id: 'asc' }]);
  });

  it('uses the field sort hook', () => {
    expect(buildPrismaOrderBy([{ field: 'docs', direction: 'desc' }], TEST_CONFIG)).toEqual([
      { debts: { _count: 'desc' } },
      { id: 'asc' },
    ]);
  });

  it('produces nothing for a computed field so the service can sort it', () => {
    expect(buildPrismaOrderBy([{ field: 'balance', direction: 'asc' }], TEST_CONFIG)).toEqual([]);
  });
});
