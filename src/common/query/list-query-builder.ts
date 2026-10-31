import { buildOrderBy, parseSortParams } from './parse-sort-params';
import { buildWhere, parseFilterParams } from './parse-filter-params';
import type { ListQueryConfig, ListQueryResult } from './list-query.types';

/**
 * Turns the raw query string object into a ready-to-use result (Vendure: `ListQueryBuilder.build`).
 * Pure function: no framework or database access, so it is covered by plain unit tests.
 */
export function parseListQuery(
  query: Record<string, unknown>,
  config: ListQueryConfig,
): ListQueryResult {
  const sort = parseSortParams(query, config);
  const filter = parseFilterParams(query, config);
  const where = buildWhere(filter, config);
  const orderBy = sort.length > 0 ? buildOrderBy(sort, config) : [];

  return {
    options: { sort, filter },
    sort,
    ...(where ? { where } : {}),
    ...(orderBy.length > 0 ? { orderBy } : {}),
  };
}

/**
 * Merges a list query into the service's own Prisma arguments. The service's `where` (always holding
 * the tenant condition) is ANDed with the client's filters, and the client's sort replaces the
 * service's default order only when one was requested.
 */
export function applyListQuery<Where, OrderBy>(
  listQuery: ListQueryResult | undefined,
  base: { where: Where; orderBy: OrderBy },
): { where: Where; orderBy: OrderBy } {
  return {
    where: listQuery?.where
      ? ({ AND: [base.where, listQuery.where] } as unknown as Where)
      : base.where,
    orderBy: (listQuery?.orderBy as unknown as OrderBy | undefined) ?? base.orderBy,
  };
}
