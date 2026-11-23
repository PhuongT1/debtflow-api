import { DateTime } from 'luxon';

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function businessDateTime(value: Date) {
  const date = DateTime.fromJSDate(value, { zone: BUSINESS_TIME_ZONE });
  if (!date.isValid) throw new RangeError('Invalid business date');
  return date;
}

/** Return inclusive calendar bounds as JavaScript Date instances for database comparisons. */
function calendarRange(date: DateTime<true>, unit: 'day' | 'month') {
  return { start: date.startOf(unit).toJSDate(), end: date.endOf(unit).toJSDate() };
}

export function getBusinessDayRange(value = new Date()) {
  return calendarRange(businessDateTime(value), 'day');
}

export function getBusinessDayRangeForDate(value: string) {
  if (!BUSINESS_DATE_PATTERN.test(value)) throw new RangeError('Invalid business date');
  const date = DateTime.fromISO(value, { zone: BUSINESS_TIME_ZONE });
  if (!date.isValid || date.toISODate() !== value) throw new RangeError('Invalid business date');
  return calendarRange(date, 'day');
}

export function getBusinessMonthRange(value = new Date()) {
  return calendarRange(businessDateTime(value), 'month');
}

export function addBusinessDays(value: Date, days: number) {
  return businessDateTime(value).plus({ days }).toJSDate();
}

export function formatBusinessDate(value = new Date()) {
  return businessDateTime(value).toISODate();
}
