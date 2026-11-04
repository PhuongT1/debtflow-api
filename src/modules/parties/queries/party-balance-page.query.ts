import { DebtStatus, DebtType, Prisma } from '#generated/prisma/client.js';
import type { SortItem } from '#common/query/index.js';
import type { Pagination } from '#common/utils/pagination.util.js';
import { requireOrganizationId } from '#common/validation/require-organization-id.js';
import { PARTY_LIST_QUERY } from './parties.list-query.js';
import { partyColumn, partyWhereSql } from './party-filter.sql.js';

const AGGREGATE_COLUMNS: Record<string, Prisma.Sql> = {
  receivable: Prisma.sql`COALESCE(totals.receivable, 0)`,
  payable: Prisma.sql`COALESCE(totals.payable, 0)`,
  outstandingDocuments: Prisma.sql`COALESCE(totals."debtCount", 0)`,
};

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

  const aggregateColumn = Object.hasOwn(AGGREGATE_COLUMNS, field)
    ? AGGREGATE_COLUMNS[field]
    : undefined;
  const column = aggregateColumn ?? partyColumn(field);
  const projection = aggregateColumn ? Prisma.empty : Prisma.sql`, ${column}`;
  const order =
    direction === 'asc'
      ? Prisma.sql`${column} ASC NULLS LAST`
      : Prisma.sql`${column} DESC NULLS FIRST`;
  const countDocuments = field === 'outstandingDocuments';
  const active = Prisma.sql`d."status" IN (${DebtStatus.OPEN}::"DebtStatus", ${DebtStatus.PARTIAL}::"DebtStatus")`;
  return Prisma.sql`
    WITH filtered AS (
      SELECT p."id"${projection}
      FROM "Party" p
      WHERE p."organizationId" = ${organizationId} AND p."isActive" = TRUE AND ${partyWhereSql(where)}
    ), totals AS (
      SELECT d."partyId",
        SUM(d."originalAmount" - d."paidAmount") FILTER (WHERE ${active} AND d."type" = ${DebtType.RECEIVABLE}::"DebtType") AS receivable,
        SUM(d."originalAmount" - d."paidAmount") FILTER (WHERE ${active} AND d."type" = ${DebtType.PAYABLE}::"DebtType") AS payable
        ${countDocuments ? Prisma.sql`, COUNT(*) AS "debtCount"` : Prisma.empty}
      FROM "Debt" d JOIN filtered selected ON selected."id" = d."partyId"
      WHERE d."organizationId" = ${organizationId} ${countDocuments ? Prisma.empty : Prisma.sql`AND ${active}`}
      GROUP BY d."partyId"
    )
    SELECT p."id", COALESCE(totals.receivable, 0) AS receivable, COALESCE(totals.payable, 0) AS payable
    FROM filtered p LEFT JOIN totals ON totals."partyId" = p."id"
    ORDER BY ${order}, p."id" ASC LIMIT ${pagination.take} OFFSET ${pagination.skip}
  `;
}
