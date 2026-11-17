/**
 * Builds parameterized PostgreSQL for Party sorting before pagination; no DB calls here.
 * Only the sort aggregate spans all matches; response balances are computed for the selected page.
 */
import { DebtType, Prisma } from '@generated/prisma/client.js';
import type { SortItem } from '@common/query/index.js';
import type { Pagination } from '@common/utils/pagination.util.js';
import { requireOrganizationId } from '@common/validation/require-organization-id.js';
import {
  PARTY_LIST_QUERY,
  PARTY_COMPUTED_SORT_FIELDS,
  type PartyComputedSortField,
} from '../../party.list-query.js';
import { PARTY_BALANCE_STATUSES } from '../queries/party.query.js';
import { partyColumn, partyWhereSql } from './party-filter.sql.js';

const SORT_AGGREGATES = {
  [PARTY_COMPUTED_SORT_FIELDS.receivable]: {
    expression: Prisma.sql`SUM(d."originalAmount" - d."paidAmount")`,
    type: DebtType.RECEIVABLE,
  },
  [PARTY_COMPUTED_SORT_FIELDS.payable]: {
    expression: Prisma.sql`SUM(d."originalAmount" - d."paidAmount")`,
    type: DebtType.PAYABLE,
  },
  // Legacy alias: count all tenant debts, including paid and cancelled debts.
  [PARTY_COMPUTED_SORT_FIELDS.outstandingDocuments]: {
    expression: Prisma.sql`COUNT(*)`,
    type: undefined,
  },
} satisfies Record<PartyComputedSortField, { expression: Prisma.Sql; type: DebtType | undefined }>;

/** One selected sort plus the internal ID tie-breaker; only a page leaves PostgreSQL. */
export function partyBalancePageSql(
  organizationId: string,
  where: Prisma.PartyWhereInput,
  sort: SortItem,
  pagination: Pick<Pagination, 'take' | 'skip'>,
): Prisma.Sql {
  requireOrganizationId(organizationId);
  const { field, direction } = sort;
  const definition = PARTY_LIST_QUERY.fields[field];
  if (
    !Object.hasOwn(PARTY_LIST_QUERY.fields, field) ||
    !definition ||
    definition.sortable === false ||
    (direction !== 'asc' && direction !== 'desc')
  )
    throw new Error('Unsupported Party SQL sort');

  const aggregate = Object.hasOwn(SORT_AGGREGATES, field)
    ? SORT_AGGREGATES[field as PartyComputedSortField]
    : undefined;
  const active = Prisma.sql`d."status" IN (${Prisma.join(
    PARTY_BALANCE_STATUSES.map((status) => Prisma.sql`${status}::"DebtStatus"`),
  )})`;
  const sortTotals = aggregate
    ? Prisma.sql`, sort_totals AS (
    SELECT d."partyId", ${aggregate.expression} AS value
    FROM "Debt" d JOIN filtered selected ON selected."id" = d."partyId"
    WHERE d."organizationId" = ${organizationId}
      ${aggregate.type ? Prisma.sql`AND ${active} AND d."type" = ${aggregate.type}::"DebtType"` : Prisma.empty}
    GROUP BY d."partyId"
  )`
    : Prisma.empty;
  const sortValue = aggregate ? Prisma.sql`COALESCE(sort_totals.value, 0)` : partyColumn(field);
  const order = direction === 'asc' ? Prisma.sql`ASC NULLS LAST` : Prisma.sql`DESC NULLS FIRST`;

  return Prisma.sql`
    WITH filtered AS (
      SELECT p."id"${aggregate ? Prisma.empty : Prisma.sql`, ${sortValue}`}
      FROM "Party" p
      WHERE p."organizationId" = ${organizationId} AND p."isActive" = TRUE AND ${partyWhereSql(where)}
    )${sortTotals}, page AS (
      SELECT p."id", ${sortValue} AS "sortValue"
      FROM filtered p
      ${aggregate ? Prisma.sql`LEFT JOIN sort_totals ON sort_totals."partyId" = p."id"` : Prisma.empty}
      ORDER BY "sortValue" ${order}, p."id" ASC LIMIT ${pagination.take} OFFSET ${pagination.skip}
    ), page_balances AS (
      SELECT d."partyId",
        SUM(d."originalAmount" - d."paidAmount") FILTER (WHERE d."type" = ${DebtType.RECEIVABLE}::"DebtType") AS receivable,
        SUM(d."originalAmount" - d."paidAmount") FILTER (WHERE d."type" = ${DebtType.PAYABLE}::"DebtType") AS payable
      FROM "Debt" d JOIN page selected ON selected."id" = d."partyId"
      WHERE d."organizationId" = ${organizationId} AND ${active}
      GROUP BY d."partyId"
    )
    SELECT page."id", COALESCE(balances.receivable, 0) AS receivable, COALESCE(balances.payable, 0) AS payable
    FROM page LEFT JOIN page_balances balances ON balances."partyId" = page."id"
    ORDER BY page."sortValue" ${order}, page."id" ASC
  `;
}
