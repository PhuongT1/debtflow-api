/**
 * Transport-neutral contract of every list query, modeled on Vendure's `ListQueryOptions`
 * (`skip`/`take`, `sort`, `filter`, `filterOperator`). HTTP parsing produces these options and the
 * Prisma builder consumes them, so another transport (GraphQL, CSV import, ...) can reuse the builder.
 */

import type { Prisma } from '@generated/prisma/client.js';

export const FILTER_OPERATORS = [
  'eq',
  'notEq',
  'in',
  'notIn',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'lt',
  'lte',
  'gt',
  'gte',
  'before',
  'after',
  'between',
  'isNull',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export type FieldType = 'string' | 'enum' | 'number' | 'decimal' | 'date' | 'boolean';

/** Operators allowed for each data type (Vendure: StringOperators, NumberOperators, DateOperators, ...). */
export const OPERATORS_BY_TYPE: Record<FieldType, readonly FilterOperator[]> = {
  string: [
    'eq',
    'notEq',
    'in',
    'notIn',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'isNull',
  ],
  enum: ['eq', 'notEq', 'in', 'notIn', 'isNull'],
  number: ['eq', 'notEq', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'between', 'isNull'],
  decimal: ['eq', 'notEq', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'between', 'isNull'],
  date: ['eq', 'lt', 'lte', 'gt', 'gte', 'before', 'after', 'between', 'isNull'],
  boolean: ['eq', 'notEq', 'isNull'],
};

/** Reuse the ordering accepted by the generated Prisma client. */
export type SortDirection = Prisma.SortOrder;
export type LogicalOperator = 'AND' | 'OR';

export type PrismaFragment = Record<string, unknown>;

export type ListQueryField = {
  type: FieldType;
  /** Allowed values for `enum` fields, e.g. `Object.values(DebtStatus)`. */
  values?: readonly string[];
  /** Prisma path when it differs from the public name, e.g. `party.name` (to-one relations only). */
  path?: string;
  /** Enables the `isNull` operator. */
  nullable?: boolean;
  /** Default true. */
  filterable?: boolean;
  /** Default true. */
  sortable?: boolean;
  /** Narrows the operators derived from `type`. */
  operators?: readonly FilterOperator[];
  description?: string;
  /**
   * Derived value that is not a database column (Vendure: `@Calculated`). The field is accepted by
   * `sortBy`, but no `orderBy` is generated: the feature must apply the complete ordering before paging.
   * Unless a `filter` hook is given, a computed field cannot be filtered.
   */
  computed?: boolean;
  /** Custom Prisma `orderBy` for the field, e.g. `(d) => ({ debts: { _count: d } })`. */
  sort?: (direction: SortDirection) => PrismaFragment;
  /** Custom Prisma `where` for the field. Receives the already validated operator and value. */
  filter?: (operator: FilterOperator, value: unknown) => PrismaFragment;
};

export type ListQueryConfig = {
  /** Prisma model name. When set, the fields are verified against the Prisma schema at startup. */
  model?: Prisma.ModelName;
  fields: Record<string, ListQueryField>;
};

export type SortItem = { field: string; direction: SortDirection };
export type FilterCondition = { field: string; operator: FilterOperator; value: unknown };
export type FilterGroup = { operator: LogicalOperator; conditions: FilterNode[] };
export type FilterNode = FilterCondition | FilterGroup;

export type ListQueryOptions = {
  /** Zero or one client-selected field; database ordering may append an internal ID tie-breaker. */
  sort: SortItem[];
  filter: FilterGroup;
};

/** Shares the requested sort contract instead of maintaining a second declaration. */
export type ListQueryResult = Pick<ListQueryOptions, 'sort'> & {
  options: ListQueryOptions;
  /** Prisma `where` fragment to AND with the service's own conditions. Undefined if nothing to filter. */
  where?: PrismaFragment;
  /** Prisma `orderBy` list with a stable `id` tie-breaker. Undefined when the client sent no sort. */
  orderBy?: PrismaFragment[];
};

export type RawSortParams = {
  /** Exactly one allow-listed field. */
  sortBy?: unknown;
  /** `asc` or `desc` (case-insensitive), default `asc`. */
  sortOrder?: unknown;
};
