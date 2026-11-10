/** Validates HTTP sort parameters and builds Prisma orderBy; computed sorts stay feature-owned. */
import { getListQueryFieldNames, buildNestedPath } from './list-query.helpers.js';
import { badRequest } from '@common/errors/app-errors.js';
import {
  type RawSortParams,
  type ListQueryConfig,
  type PrismaFragment,
  type SortDirection,
  type SortItem,
} from './list-query.types.js';

/** Parse one client-selected field; the ID tie-breaker is an internal paging detail. */
export function parseSortParams(raw: RawSortParams, config: ListQueryConfig): SortItem[] {
  const order = raw.sortOrder === undefined ? 'asc' : raw.sortOrder;
  if (typeof order !== 'string' || !['asc', 'desc'].includes(order.toLowerCase()))
    throw badRequest('query.INVALID_SORT_ORDER', { value: String(order) });
  if (raw.sortBy === undefined || raw.sortBy === '') return [];
  const field = typeof raw.sortBy === 'string' ? raw.sortBy : '';
  const definition = config.fields[field];
  if (!Object.hasOwn(config.fields, field) || !definition || definition.sortable === false)
    throw badRequest('query.INVALID_SORT', {
      field: field || String(raw.sortBy),
      validFields: getListQueryFieldNames(config, 'sortable').join(', '),
    });
  return [{ field, direction: order.toLowerCase() as SortDirection }];
}

/** Compiles the sort to a Prisma `orderBy` list. Computed fields are delegated to the feature-owned query path. */
export function buildPrismaOrderBy(sort: SortItem[], config: ListQueryConfig): PrismaFragment[] {
  const orderBy: PrismaFragment[] = [];

  for (const { field, direction } of sort) {
    const definition = config.fields[field];

    if (definition.sort) orderBy.push(definition.sort(direction));
    else if (!definition.computed)
      orderBy.push(buildNestedPath(definition.path ?? field, direction));
  }

  // A unique tie-breaker keeps pagination stable when the sorted column has duplicates.
  return orderBy.length > 0 || sort.length === 0 ? [...orderBy, { id: 'asc' }] : [];
}
