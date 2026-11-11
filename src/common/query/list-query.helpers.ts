/** Shared list-query capability lookups and nested Prisma paths; no HTTP parsing or DB calls. */
import { OPERATORS_BY_TYPE } from './list-query.types.js';
import type {
  FilterNode,
  FilterGroup,
  FilterOperator,
  ListQueryConfig,
  ListQueryField,
  PrismaFragment,
} from './list-query.types.js';

export const isFilterGroup = (node: FilterNode): node is FilterGroup => 'conditions' in node;

export function getAllowedFilterOperators(field: ListQueryField): readonly FilterOperator[] {
  const base = field.operators ?? OPERATORS_BY_TYPE[field.type];

  return base.filter((operator) => operator !== 'isNull' || field.nullable);
}

export function getListQueryFieldNames(
  config: ListQueryConfig,
  capability: 'sortable' | 'filterable',
): string[] {
  return Object.entries(config.fields)
    .filter(([, field]) => field[capability] !== false)
    .map(([name]) => name);
}

/** `party.name` + value -> `{ party: { name: value } }` */
export function buildNestedPath(path: string, value: unknown): PrismaFragment {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((inner, key) => ({ [key]: inner }), value) as PrismaFragment;
}
