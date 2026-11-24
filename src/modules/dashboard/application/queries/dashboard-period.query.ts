import { ApplicationError } from '@common/errors/application-error.js';
import { getBusinessDayRangeForDate } from '@common/utils/business-date.util.js';
import type { DashboardPeriodInput } from '../dashboard-period.types.js';

export function getDashboardPeriod(query: DashboardPeriodInput | undefined) {
  const read = (value: string | undefined, field: string) => {
    if (value === undefined) return undefined;
    try {
      return getBusinessDayRangeForDate(value);
    } catch {
      throw new ApplicationError('invalid', 'query.INVALID_FILTER_VALUE', { field });
    }
  };
  const start = read(query?.dateFrom, 'dateFrom')?.start;
  const end = read(query?.dateTo, 'dateTo')?.end;
  if (start && end && start > end)
    throw new ApplicationError('invalid', 'parties.INVALID_DATE_RANGE');
  return { start, end };
}
