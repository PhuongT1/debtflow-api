import { addBusinessDays, getBusinessDayRange } from '@common/utils/business-date.util.js';

/** Calendar-day aging in Vietnam: due today is not overdue; yesterday is day 1. */
export function getDebtAgingRanges(now: Date) {
  const { start } = getBusinessDayRange(now);
  return {
    not_due: { gte: start },
    '1_7': { gte: addBusinessDays(start, -7), lt: start },
    '8_30': { gte: addBusinessDays(start, -30), lt: addBusinessDays(start, -7) },
    '31_60': { gte: addBusinessDays(start, -60), lt: addBusinessDays(start, -30) },
    '60_plus': { lt: addBusinessDays(start, -60) },
  };
}
