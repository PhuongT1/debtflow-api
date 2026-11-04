import { describe, expect, it } from 'vitest';
import { applyListQuery, parseListQuery } from './list-query-builder.js';
import { TEST_CONFIG } from './test-config.js';

describe('parseListQuery', () => {
  it('returns only what was requested', () => {
    const empty = parseListQuery({}, TEST_CONFIG);
    expect(empty.where).toBeUndefined();
    expect(empty.orderBy).toBeUndefined();
    expect(empty.sort).toEqual([]);
  });

  it('combines sort and filter', () => {
    const result = parseListQuery(
      { sortBy: 'dueDate', sortOrder: 'desc', 'filter[status][in]': 'OPEN,PAID' },
      TEST_CONFIG,
    );

    expect(result.where).toEqual({ AND: [{ status: { in: ['OPEN', 'PAID'] } }] });
    expect(result.orderBy).toEqual([{ dueDate: 'desc' }, { id: 'asc' }]);
    expect(result.options.filter.operator).toBe('AND');
  });

  it('keeps a computed sort for the service but generates no orderBy', () => {
    const result = parseListQuery({ sortBy: 'balance', sortOrder: 'desc' }, TEST_CONFIG);

    expect(result.sort).toEqual([{ field: 'balance', direction: 'desc' }]);
    expect(result.orderBy).toBeUndefined();
  });
});

describe('applyListQuery', () => {
  const base = { where: { organizationId: 'org-1' }, orderBy: [{ createdAt: 'desc' }] };

  it('returns the service arguments untouched without a list query', () => {
    expect(applyListQuery(undefined, base)).toEqual(base);
    expect(applyListQuery(parseListQuery({}, TEST_CONFIG), base)).toEqual(base);
  });

  it('always keeps the tenant condition and ANDs the client filters', () => {
    const result = applyListQuery(
      parseListQuery({ 'filter[code]': 'A1', filterOperator: 'OR' }, TEST_CONFIG),
      base,
    );

    expect(result.where).toEqual({
      AND: [{ organizationId: 'org-1' }, { OR: [{ code: { equals: 'A1' } }] }],
    });
  });

  it('replaces the default order only when the client sorted', () => {
    const sorted = applyListQuery(parseListQuery({ sortBy: 'code' }, TEST_CONFIG), base);

    expect(sorted.orderBy).toEqual([{ code: 'asc' }, { id: 'asc' }]);
    expect(
      applyListQuery(parseListQuery({ 'filter[code]': 'x' }, TEST_CONFIG), base).orderBy,
    ).toEqual(base.orderBy);
  });
});
