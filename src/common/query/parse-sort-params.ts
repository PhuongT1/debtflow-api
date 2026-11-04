import { badRequest } from '#common/errors/app-errors.js';
import {
  validFieldsOf,
  type ListQueryConfig,
  type PrismaFragment,
  type SortDirection,
  type SortItem,
} from './list-query.types.js';

export type RawSortParams = {
  /** Exactly one allow-listed field. */
  sortBy?: unknown;
  /** `asc` or `desc` (case-insensitive), default `asc`. */
  sortOrder?: unknown;
};

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
      validFields: validFieldsOf(config, 'sortable').join(', '),
    });
  return [{ field, direction: order.toLowerCase() as SortDirection }];
}

/** Compiles the sort to a Prisma `orderBy` list. Computed fields are delegated to the feature-owned query path. */
export function buildOrderBy(sort: SortItem[], config: ListQueryConfig): PrismaFragment[] {
  const orderBy: PrismaFragment[] = [];

  for (const { field, direction } of sort) {
    const definition = config.fields[field];

    if (definition.sort) orderBy.push(definition.sort(direction));
    else if (!definition.computed) orderBy.push(nest(definition.path ?? field, direction));
  }

  // A unique tie-breaker keeps pagination stable when the sorted column has duplicates.
  return orderBy.length > 0 || sort.length === 0 ? [...orderBy, { id: 'asc' }] : [];
}

/** `party.name` + value -> `{ party: { name: value } }` */
export function nest(path: string, value: unknown): PrismaFragment {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((inner, key) => ({ [key]: inner }), value) as PrismaFragment;
}
