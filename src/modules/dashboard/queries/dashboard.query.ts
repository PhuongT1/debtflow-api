import { badRequest } from '#common/errors/app-errors.js';
import { getBusinessDayRangeForDate } from '#common/utils/business-date.util.js';
import type { DashboardQueryDto } from '../dto/query-dashboard.dto.js';

export function getDashboardPeriod(query: DashboardQueryDto | undefined) {
  const read = (value: string | undefined, field: string) => {
    if (value === undefined) return undefined;
    try {
      return getBusinessDayRangeForDate(value);
    } catch {
      throw badRequest('query.INVALID_FILTER_VALUE', { field });
    }
  };
  const start = read(query?.dateFrom, 'dateFrom')?.start;
  const end = read(query?.dateTo, 'dateTo')?.end;
  if (start && end && start > end) throw badRequest('parties.INVALID_DATE_RANGE');
  return { start, end };
}
