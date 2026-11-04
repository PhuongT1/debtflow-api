import { describe, expect, it } from 'vitest';
import { buildWhere, isListQueryKey, parseFilterParams } from './parse-filter-params';
import { errorOf, TEST_CONFIG } from './test-config';

const where = (query: Record<string, unknown>) =>
  buildWhere(parseFilterParams(query, TEST_CONFIG), TEST_CONFIG);

type DateCondition = Record<string, Record<string, Date>>;
const firstCondition = (query: Record<string, unknown>) =>
  (where(query) as { AND: DateCondition[] }).AND[0];

describe('parseFilterParams + buildWhere', () => {
  it('returns nothing when there is no filter', () => {
    expect(where({})).toBeUndefined();
    expect(where({ page: '1', q: 'x' })).toBeUndefined();
  });

  it('treats a bare filter as eq and combines fields with AND', () => {
    expect(where({ 'filter[status]': 'OPEN', 'filter[code]': 'A1' })).toEqual({
      AND: [{ status: { equals: 'OPEN' } }, { code: { equals: 'A1' } }],
    });
  });

  it('supports OR through filterOperator', () => {
    expect(where({ 'filter[status]': 'OPEN', 'filter[code]': 'A1', filterOperator: 'or' })).toEqual(
      {
        OR: [{ status: { equals: 'OPEN' } }, { code: { equals: 'A1' } }],
      },
    );
    expect(errorOf(() => where({ filterOperator: 'XOR' })).code).toBe(
      'INVALID_FILTER_OPERATOR_GROUP',
    );
  });

  describe('string', () => {
    it('maps the text operators case-insensitively', () => {
      expect(where({ 'filter[code][contains]': 'ab' })).toEqual({
        AND: [{ code: { contains: 'ab', mode: 'insensitive' } }],
      });
      expect(where({ 'filter[code][startsWith]': 'ab' })).toEqual({
        AND: [{ code: { startsWith: 'ab', mode: 'insensitive' } }],
      });
      expect(where({ 'filter[code][notEq]': 'ab' })).toEqual({ AND: [{ code: { not: 'ab' } }] });
    });

    it('negates notContains at the condition level', () => {
      expect(where({ 'filter[code][notContains]': 'ab' })).toEqual({
        AND: [{ NOT: { code: { contains: 'ab', mode: 'insensitive' } } }],
      });
    });

    it('nests relation paths', () => {
      expect(where({ 'filter[partyName][contains]': 'an' })).toEqual({
        AND: [{ party: { name: { contains: 'an', mode: 'insensitive' } } }],
      });
    });
  });

  describe('enum', () => {
    it('accepts in / notIn lists and repeated keys', () => {
      expect(where({ 'filter[status][in]': 'OPEN,PAID' })).toEqual({
        AND: [{ status: { in: ['OPEN', 'PAID'] } }],
      });
      expect(where({ 'filter[status][notIn]': 'PAID' })).toEqual({
        AND: [{ status: { notIn: ['PAID'] } }],
      });
      expect(where({ 'filter[status]': ['OPEN', 'PAID'] })).toEqual({
        AND: [{ status: { in: ['OPEN', 'PAID'] } }],
      });
    });

    it('rejects values outside the enum', () => {
      expect(errorOf(() => where({ 'filter[status]': 'NOPE' })).code).toBe('INVALID_FILTER_VALUE');
      expect(errorOf(() => where({ 'filter[status][in]': 'OPEN,NOPE' })).code).toBe(
        'INVALID_FILTER_VALUE',
      );
    });
  });

  describe('number and decimal', () => {
    it('maps comparisons and between', () => {
      expect(where({ 'filter[quantity][gte]': '5' })).toEqual({
        AND: [{ quantity: { gte: 5 } }],
      });
      expect(where({ 'filter[amount][between]': '10.5,20' })).toEqual({
        AND: [{ amount: { gte: '10.5', lte: '20' } }],
      });
    });

    it('rejects malformed numbers and a wrong number of between values', () => {
      expect(errorOf(() => where({ 'filter[quantity]': 'abc' })).code).toBe('INVALID_FILTER_VALUE');
      expect(errorOf(() => where({ 'filter[amount]': '1e5' })).code).toBe('INVALID_FILTER_VALUE');
      expect(errorOf(() => where({ 'filter[amount][between]': '1' })).code).toBe(
        'INVALID_FILTER_VALUE',
      );
    });
  });

  describe('date', () => {
    it('treats a date-only eq as the whole business day (+07:00)', () => {
      const [condition] = [firstCondition({ 'filter[dueDate]': '2026-09-30' })];
      expect(condition.dueDate.gte.toISOString()).toBe('2026-09-29T17:00:00.000Z');
      expect(condition.dueDate.lte.toISOString()).toBe('2026-09-30T16:59:59.999Z');
    });

    it('starts gte/after... at the right edge of the day', () => {
      const [lte] = [firstCondition({ 'filter[dueDate][lte]': '2026-09-30' })];
      expect(lte.dueDate.lte.toISOString()).toBe('2026-09-30T16:59:59.999Z');

      const [before] = [firstCondition({ 'filter[dueDate][before]': '2026-09-30' })];
      expect(before.dueDate.lt.toISOString()).toBe('2026-09-29T17:00:00.000Z');

      const [after] = [firstCondition({ 'filter[dueDate][after]': '2026-09-30' })];
      expect(after.dueDate.gt.toISOString()).toBe('2026-09-30T16:59:59.999Z');
    });

    it('uses an exact instant for a full timestamp and covers between', () => {
      const [exact] = [firstCondition({ 'filter[dueDate]': '2026-09-30T10:00:00Z' })];
      expect(exact.dueDate.equals.toISOString()).toBe('2026-09-30T10:00:00.000Z');

      const [between] = [firstCondition({ 'filter[dueDate][between]': '2026-09-01,2026-09-30' })];
      expect(between.dueDate.gte.toISOString()).toBe('2026-08-31T17:00:00.000Z');
      expect(between.dueDate.lte.toISOString()).toBe('2026-09-30T16:59:59.999Z');
    });

    it('rejects an invalid date', () => {
      expect(errorOf(() => where({ 'filter[dueDate]': 'tomorrow' })).code).toBe(
        'INVALID_FILTER_VALUE',
      );
    });

    it('rejects impossible calendar dates and invalid months as 400 errors', () => {
      for (const value of ['2026-02-30', '2026-13-01', '2026-00-01']) {
        expect(errorOf(() => where({ 'filter[dueDate]': value })).code).toBe(
          'INVALID_FILTER_VALUE',
        );
      }
    });
  });

  describe('boolean and isNull', () => {
    it('parses booleans', () => {
      expect(where({ 'filter[isActive]': 'true' })).toEqual({
        AND: [{ isActive: { equals: true } }],
      });
      expect(errorOf(() => where({ 'filter[isActive]': 'yes' })).code).toBe('INVALID_FILTER_VALUE');
    });

    it('allows isNull only on nullable fields', () => {
      expect(where({ 'filter[note][isNull]': 'true' })).toEqual({
        AND: [{ note: { equals: null } }],
      });
      expect(where({ 'filter[note][isNull]': 'false' })).toEqual({
        AND: [{ note: { not: null } }],
      });
      expect(errorOf(() => where({ 'filter[code][isNull]': 'true' })).code).toBe(
        'INVALID_FILTER_OPERATOR',
      );
    });
  });

  describe('rejections', () => {
    it('does not treat inherited object properties as allowed fields', () => {
      for (const field of ['constructor', 'toString', '__proto__']) {
        expect(errorOf(() => where({ [`filter[${field}]`]: 'x' })).code).toBe(
          'INVALID_FILTER_FIELD',
        );
      }
    });
    it('rejects unknown, non-filterable and computed fields and lists the valid ones', () => {
      const unknown = errorOf(() => where({ 'filter[organizationId]': 'x' }));
      expect(unknown.code).toBe('INVALID_FILTER_FIELD');
      expect(String(unknown.params?.validFields)).toContain('status');
      expect(String(unknown.params?.validFields)).not.toContain('secret');
      expect(String(unknown.params?.validFields)).not.toContain('balance');

      expect(errorOf(() => where({ 'filter[secret]': 'x' })).code).toBe('INVALID_FILTER_FIELD');
      expect(errorOf(() => where({ 'filter[balance]': '1' })).code).toBe('INVALID_FILTER_FIELD');
    });

    it('rejects an operator that does not belong to the type and lists the valid ones', () => {
      const error = errorOf(() => where({ 'filter[status][gt]': 'OPEN' }));
      expect(error.code).toBe('INVALID_FILTER_OPERATOR');
      expect(String(error.params?.validOperators)).toContain('notIn');

      expect(errorOf(() => where({ 'filter[code][between]': 'a,b' })).code).toBe(
        'INVALID_FILTER_OPERATOR',
      );
      expect(errorOf(() => where({ 'filter[code][drop]': 'a' })).code).toBe(
        'INVALID_FILTER_OPERATOR',
      );
    });

    it('limits the number of list values', () => {
      const many = Array.from({ length: 51 }, (_, index) => `c${index}`).join(',');
      expect(errorOf(() => where({ 'filter[code][in]': many })).code).toBe('INVALID_FILTER_VALUE');
    });
  });
});

describe('isListQueryKey', () => {
  it('recognizes the keys owned by the list query', () => {
    for (const key of [
      'sortBy',
      'sortOrder',
      'filterOperator',
      'filter[status]',
      'filter[a.b][in]',
    ]) {
      expect(isListQueryKey(key)).toBe(true);
    }
    for (const key of ['sort', 'page', 'q', 'filter', 'status', 'filter[]']) {
      expect(isListQueryKey(key)).toBe(false);
    }
  });
});
