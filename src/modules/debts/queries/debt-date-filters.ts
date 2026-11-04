import { getDebtAgingRanges } from '../rules/debt-aging.rules.js';
import { badRequest } from '#common/errors/app-errors.js';
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessDayRange,
  getBusinessDayRangeForDate,
} from '#common/utils/business-date.util.js';
import type { Prisma } from '#generated/prisma/client.js';
import type { QueryDebtsDto } from '../dto/query-debts.dto.js';

/** Each selected date condition remains separate so later filters cannot overwrite it. */
export function buildDebtDateFilters(query: QueryDebtsDto, now: Date): Prisma.DebtWhereInput[] {
  const conditions: Prisma.DebtWhereInput[] = [];
  const { start, end } = getBusinessDayRange(now);
  const aging = query.aging ? getDebtAgingRanges(now)[query.aging] : undefined;
  const followUp = followUpRange(query.followUp, start, end);
  const due = dueRange(query.dueRange, start, end);

  if (aging) conditions.push({ dueDate: aging });
  if (followUp) conditions.push({ nextFollowUpAt: followUp });
  if (due) conditions.push({ dueDate: due });
  if (query.overdue === 'true') conditions.push({ dueDate: { lt: start } });
  if (query.dueDate) {
    const day = readDate(query.dueDate, 'dueDate');
    conditions.push({ dueDate: { gte: day.start, lte: day.end } });
  }
  if (query.dueDateFrom || query.dueDateTo) {
    const from = query.dueDateFrom ? readDate(query.dueDateFrom, 'dueDateFrom').start : undefined;
    const to = query.dueDateTo ? readDate(query.dueDateTo, 'dueDateTo').end : undefined;
    if (from && to && from > to)
      throw badRequest('query.INVALID_FILTER_VALUE', { field: 'dueDateTo' });
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    conditions.push({ dueDate: range });
  }
  return conditions;
}

function followUpRange(
  value: QueryDebtsDto['followUp'],
  start: Date,
  end: Date,
): Prisma.DateTimeFilter | undefined {
  switch (value) {
    case 'today':
      return { gte: start, lte: end };
    case 'overdue':
      return { lt: start };
    case 'upcoming':
      return { gt: end };
  }
}

function dueRange(
  value: QueryDebtsDto['dueRange'],
  start: Date,
  end: Date,
): Prisma.DateTimeFilter | undefined {
  switch (value) {
    case 'today':
      return { gte: start, lte: end };
    case 'tomorrow':
      return { gte: addBusinessDays(start, 1), lte: addBusinessDays(end, 1) };
    case 'next_7_days':
      return { gte: start, lte: addBusinessDays(end, 6) };
    case 'this_month': {
      const first = formatBusinessDate(start).slice(0, 7) + '-01';
      const [year, month] = first.split('-').map(Number);
      return {
        gte: getBusinessDayRangeForDate(first).start,
        lte: new Date(Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000 - 1),
      };
    }
  }
}

function readDate(value: string, field: string) {
  try {
    return getBusinessDayRangeForDate(value);
  } catch {
    throw badRequest('query.INVALID_FILTER_VALUE', { field });
  }
}
