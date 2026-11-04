import { describe, expect, it } from 'vitest';
import { getDebtAgingRanges, DEBT_AGING_VALUES } from './debt-aging.rules.js';
import { buildDebtDateFilters } from '../queries/debt-date-filters.js';

describe('shared Vietnam calendar aging', () => {
  const now = new Date('2026-11-01T05:00:00Z');
  const start = new Date('2026-10-31T17:00:00Z');
  const day = 86_400_000;
  it.each([
    [-1, 'not_due'],
    [0, 'not_due'],
    [1, '1_7'],
    [7, '1_7'],
    [8, '8_30'],
    [30, '8_30'],
    [31, '31_60'],
    [60, '31_60'],
    [61, '60_plus'],
  ])('assigns a due date %s calendar days ago to exactly one bucket', (days, expected) => {
    const date = new Date(start.getTime() - Number(days) * day);
    const ranges = getDebtAgingRanges(now);
    const matching = DEBT_AGING_VALUES.filter((key) => {
      const range: { gte?: Date; lt?: Date } = ranges[key];
      return (!range.gte || date >= range.gte) && (!range.lt || date < range.lt);
    });
    expect(matching).toEqual([expected]);
  });
  it('uses the identical range for list filters and keeps a debt due earlier today not overdue', () => {
    const ranges = getDebtAgingRanges(now);
    for (const aging of DEBT_AGING_VALUES)
      expect(buildDebtDateFilters({ aging }, now)[0]).toEqual({ dueDate: ranges[aging] });
    expect(ranges.not_due.gte).toEqual(start);
    expect(new Date('2026-10-31T23:00:00Z') >= ranges.not_due.gte).toBe(true);
  });
});
