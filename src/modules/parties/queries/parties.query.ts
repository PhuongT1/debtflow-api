import { applyListQuery, type ListQueryResult } from '@common/query';
import { badRequest } from '@common/errors/app-errors';
import { partySearchText } from '@common/utils/search-normalization.util';
import {
  addBusinessDays,
  formatBusinessDate,
  getBusinessDayRange,
  getBusinessDayRangeForDate,
} from '@common/utils/business-date.util';
import { DebtStatus, Prisma } from '@generated/prisma';
import type { QueryPartiesDto } from '../dto/query-parties.dto';

/** Compose Prisma arguments only; no database calls. Omitted filters add no conditions. */
export function buildPartyQuery(
  organizationId: string,
  query: QueryPartiesDto,
  listQuery?: ListQueryResult,
) {
  // Base scope is mandatory; optional filters below only narrow it.
  const where: Prisma.PartyWhereInput = { organizationId, isActive: true };
  if (query.type) where.type = query.type;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.balanceType)
    where.debts = {
      some: {
        organizationId,
        status: { in: [DebtStatus.OPEN, DebtStatus.PARTIAL] },
        type: query.balanceType,
      },
    };
  const createdAt = createdAtFilter(query);
  if (createdAt) where.createdAt = createdAt;
  if (query.q) where.searchText = { contains: partySearchText(query.q) };
  return applyListQuery<Prisma.PartyWhereInput, Prisma.PartyOrderByWithRelationInput[]>(listQuery, {
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

function createdAtFilter(query: QueryPartiesDto): Prisma.DateTimeFilter | undefined {
  if (!query.createdFrom && !query.createdTo) return createdRange(query.createdRange);
  let from: Date | undefined;
  let to: Date | undefined;
  try {
    from = query.createdFrom ? getBusinessDayRangeForDate(query.createdFrom).start : undefined;
    to = query.createdTo ? getBusinessDayRangeForDate(query.createdTo).end : undefined;
  } catch {
    throw badRequest('parties.INVALID_DATE_RANGE');
  }
  if (from && to && from > to) throw badRequest('parties.INVALID_DATE_RANGE');
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return range;
}

function createdRange(range: QueryPartiesDto['createdRange']): Prisma.DateTimeFilter | undefined {
  if (!range) return undefined;
  const { start } = getBusinessDayRange();
  switch (range) {
    case 'today':
      return { gte: start };
    case 'last_7_days':
      return { gte: addBusinessDays(start, -6) };
    case 'this_month':
      return { gte: getBusinessDayRangeForDate(`${formatBusinessDate().slice(0, 7)}-01`).start };
  }
}
