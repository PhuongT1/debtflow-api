import { describe, expect, it } from 'vitest';
import { buildOrderBy, parseSortParams } from './parse-sort-params';
import { errorOf, TEST_CONFIG } from './test-config';

describe('parseSortParams', () => {
  it('returns an empty list when nothing is requested', () => {
    expect(parseSortParams({}, TEST_CONFIG)).toEqual([]);
    expect(parseSortParams({ sort: '' }, TEST_CONFIG)).toEqual([]);
  });

  it('parses `sort` with the - prefix for descending order', () => {
    expect(parseSortParams({ sort: '-dueDate,code' }, TEST_CONFIG)).toEqual([
      { field: 'dueDate', direction: 'desc' },
      { field: 'code', direction: 'asc' },
    ]);
  });

  it('parses sortBy + sortOrder and defaults to asc', () => {
    expect(parseSortParams({ sortBy: 'code', sortOrder: 'DESC' }, TEST_CONFIG)).toEqual([
      { field: 'code', direction: 'desc' },
    ]);
    expect(parseSortParams({ sortBy: 'code' }, TEST_CONFIG)).toEqual([
      { field: 'code', direction: 'asc' },
    ]);
  });

  it('prefers `sort` over sortBy', () => {
    expect(parseSortParams({ sort: '-code', sortBy: 'amount' }, TEST_CONFIG)).toEqual([
      { field: 'code', direction: 'desc' },
    ]);
  });

  it('ignores a repeated field', () => {
    expect(parseSortParams({ sort: 'code,-code' }, TEST_CONFIG)).toHaveLength(1);
  });

  it('rejects inherited object properties as sort fields', () => {
    for (const sort of ['constructor', 'toString', '__proto__']) {
      expect(errorOf(() => parseSortParams({ sort }, TEST_CONFIG)).code).toBe('INVALID_SORT');
    }
  });

  it('rejects unknown and non-sortable fields and lists the valid ones', () => {
    const unknown = errorOf(() => parseSortParams({ sort: 'organizationId' }, TEST_CONFIG));
    expect(unknown.code).toBe('INVALID_SORT');
    expect(unknown.params?.field).toBe('organizationId');
    expect(String(unknown.params?.validFields)).toContain('dueDate');
    expect(String(unknown.params?.validFields)).not.toContain('secret');

    expect(errorOf(() => parseSortParams({ sort: 'secret' }, TEST_CONFIG)).code).toBe(
      'INVALID_SORT',
    );
  });

  it('rejects an invalid sortOrder and more than 3 fields', () => {
    expect(
      errorOf(() => parseSortParams({ sortBy: 'code', sortOrder: 'up' }, TEST_CONFIG)).code,
    ).toBe('INVALID_SORT_ORDER');
    expect(
      errorOf(() => parseSortParams({ sort: 'code,amount,quantity,dueDate' }, TEST_CONFIG)).code,
    ).toBe('TOO_MANY_SORT_FIELDS');
  });
});

describe('buildOrderBy', () => {
  it('maps fields, nests relation paths and appends the id tie-breaker', () => {
    const orderBy = buildOrderBy(
      [
        { field: 'partyName', direction: 'desc' },
        { field: 'code', direction: 'asc' },
      ],
      TEST_CONFIG,
    );

    expect(orderBy).toEqual([{ party: { name: 'desc' } }, { code: 'asc' }, { id: 'asc' }]);
  });

  it('uses the field sort hook', () => {
    expect(buildOrderBy([{ field: 'docs', direction: 'desc' }], TEST_CONFIG)).toEqual([
      { debts: { _count: 'desc' } },
      { id: 'asc' },
    ]);
  });

  it('produces nothing for a computed field so the service can sort it', () => {
    expect(buildOrderBy([{ field: 'balance', direction: 'asc' }], TEST_CONFIG)).toEqual([]);
  });
});
