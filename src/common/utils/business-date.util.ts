const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type BusinessDateParts = { day: number; month: number; year: number };

function getBusinessDateParts(value: Date): BusinessDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  return { day: part('day'), month: part('month'), year: part('year') };
}

export function getBusinessDayRange(value = new Date()) {
  const { day, month, year } = getBusinessDateParts(value);
  const start = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + DAY_IN_MILLISECONDS - 1);

  return { end, start };
}

export function getBusinessDayRangeForDate(value: string) {
  // Date silently rolls February 30 into March; reject impossible calendar dates explicitly.
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError('Invalid business date');
  }
  return getBusinessDayRange(new Date(value + 'T12:00:00+07:00'));
}

export function addBusinessDays(start: Date, days: number) {
  return new Date(start.getTime() + days * DAY_IN_MILLISECONDS);
}

export function formatBusinessDate(value = new Date()) {
  const { day, month, year } = getBusinessDateParts(value);
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}
