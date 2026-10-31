import { badRequest } from '@common/errors/app-errors';
import {
  validFieldsOf,
  type ListQueryConfig,
  type PrismaFragment,
  type SortDirection,
  type SortItem,
} from './list-query.types';

const MAX_SORT_FIELDS = 3;

export type RawSortParams = {
  /** `sort=-dueDate,code`: comma separated, `-` prefix for descending. */
  sort?: unknown;
  /** `sortBy=dueDate`: single field, combined with `sortOrder`. Ignored when `sort` is present. */
  sortBy?: unknown;
  /** `sortOrder=asc|desc` (case-insensitive), default `asc`. */
  sortOrder?: unknown;
};

/**
 * Validates the requested sort against the allow-list and returns it in a canonical form
 * (Vendure: `parseSortParams`). Both spellings, `sort=-field,...` and `sortBy`+`sortOrder`, end up as
 * the same `SortItem[]`.
 */
export function parseSortParams(raw: RawSortParams, config: ListQueryConfig): SortItem[] {
  const tokens = toTokens(raw);
  const items: SortItem[] = [];

  for (const { field, direction } of tokens) {
    const definition = config.fields[field];

    if (!Object.hasOwn(config.fields, field) || !definition || definition.sortable === false) {
      throw badRequest('query.INVALID_SORT', {
        field,
        validFields: validFieldsOf(config, 'sortable').join(', '),
      });
    }
    if (!items.some((item) => item.field === field)) items.push({ field, direction });
  }

  if (items.length > MAX_SORT_FIELDS) {
    throw badRequest('query.TOO_MANY_SORT_FIELDS', { max: MAX_SORT_FIELDS });
  }

  return items;
}

/** Compiles the sort to a Prisma `orderBy` list. Computed fields are skipped (the service sorts them). */
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

function toTokens(raw: RawSortParams): SortItem[] {
  if (raw.sort !== undefined && raw.sort !== '') {
    const text = Array.isArray(raw.sort) ? raw.sort.join(',') : String(raw.sort);

    return text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((token) => ({
        field: token.replace(/^[-+]/, ''),
        direction: token.startsWith('-') ? 'desc' : 'asc',
      }));
  }

  if (raw.sortBy !== undefined && raw.sortBy !== '') {
    const order = String(raw.sortOrder ?? 'asc').toLowerCase();

    if (order !== 'asc' && order !== 'desc') {
      throw badRequest('query.INVALID_SORT_ORDER', { value: String(raw.sortOrder) });
    }

    return [{ field: String(raw.sortBy), direction: order as SortDirection }];
  }

  return [];
}

/** `party.name` + value -> `{ party: { name: value } }` */
export function nest(path: string, value: unknown): PrismaFragment {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((inner, key) => ({ [key]: inner }), value) as PrismaFragment;
}
