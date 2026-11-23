/**
 * Builds tenant-scoped Prisma where/orderBy arguments for Party lists.
 * Named filters and validated dynamic filters are combined here; this file does not execute DB queries.
 */
import { applyListQuery, type ListQueryResult } from '@common/query/index.js';
import { ApplicationError } from '@common/errors/application-error.js';
import { partySearchText } from '@common/utils/search-normalization.util.js';
import {
  addBusinessDays,
  getBusinessDayRange,
  getBusinessDayRangeForDate,
  getBusinessMonthRange,
} from '@common/utils/business-date.util.js';
import { DebtStatus, Prisma } from '@generated/prisma/client.js';
import type { PartyCreatedRange, PartyListInput } from '../../application/party.inputs.js';

const LAST_SEVEN_DAYS_LENGTH = 7;

/** Shared by the Prisma balance aggregate, SQL page aggregate and balance-type filter. */
export const PARTY_BALANCE_STATUSES: DebtStatus[] = [DebtStatus.OPEN, DebtStatus.PARTIAL];

/** Compose Prisma arguments only; no database calls. Omitted filters add no conditions. */
export function buildPartyListQuery(
  organizationId: string,
  query: PartyListInput,
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
        status: { in: PARTY_BALANCE_STATUSES },
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

function createdAtFilter(query: PartyListInput): Prisma.DateTimeFilter | undefined {
  const { createdFrom, createdTo } = query;
  if (createdFrom === undefined && createdTo === undefined) return createdRange(query.createdRange);
  let from: Date | undefined;
  let to: Date | undefined;
  try {
    from = createdFrom === undefined ? undefined : getBusinessDayRangeForDate(createdFrom).start;
    to = createdTo === undefined ? undefined : getBusinessDayRangeForDate(createdTo).end;
  } catch {
    throw new ApplicationError('invalid', 'parties.INVALID_DATE_RANGE');
  }
  if (from && to && from > to) throw new ApplicationError('invalid', 'parties.INVALID_DATE_RANGE');
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  return range;
}

function createdRange(range?: PartyCreatedRange): Prisma.DateTimeFilter | undefined {
  switch (range) {
    case 'today': {
      const { start, end } = getBusinessDayRange();
      return { gte: start, lte: end };
    }
    case 'last_7_days': {
      const { start, end } = getBusinessDayRange();
      return { gte: addBusinessDays(start, 1 - LAST_SEVEN_DAYS_LENGTH), lte: end };
    }
    case 'this_month': {
      const { start, end } = getBusinessMonthRange();
      return { gte: start, lte: end };
    }
  }
}
