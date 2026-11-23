import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessDayRange,
  getBusinessDayRangeForDate,
  getBusinessMonthRange,
} from '../business-date.util.js';

describe('Vietnam business calendar', () => {
  it('changes business date at midnight in Ho Chi Minh City', () => {
    expect(formatBusinessDate(new Date('2026-11-30T16:59:59.999Z'))).toBe('2026-11-30');
    const midnight = new Date('2026-11-30T17:00:00.000Z');
    expect(formatBusinessDate(midnight)).toBe('2026-12-01');
    expect(getBusinessDayRange(midnight)).toEqual({
      start: midnight,
      end: new Date('2026-12-01T16:59:59.999Z'),
    });
  });

  it('calculates the complete leap month and accepts its last calendar day', () => {
    const leapDay = getBusinessDayRangeForDate('2028-02-29');
    expect(leapDay).toEqual({
      start: new Date('2028-02-28T17:00:00.000Z'),
      end: new Date('2028-02-29T16:59:59.999Z'),
    });
    expect(getBusinessMonthRange(leapDay.start)).toEqual({
      start: new Date('2028-01-31T17:00:00.000Z'),
      end: leapDay.end,
    });
  });

  it('shifts whole business days across a year boundary and preserves the time of day', () => {
    const { end } = getBusinessDayRangeForDate('2026-12-31');
    const nextDay = addBusinessDays(end, 1);
    expect(nextDay).toEqual(new Date('2027-01-01T16:59:59.999Z'));
    expect(addBusinessDays(nextDay, -1)).toEqual(end);
  });

  it.each(['2026-02-29', '2026-02-30', '2026-11-31', '2026-1-01', '2026-01-01T00:00:00Z'])(
    'rejects %s as a date-only input',
    (value) => expect(() => getBusinessDayRangeForDate(value)).toThrow(RangeError),
  );
});
