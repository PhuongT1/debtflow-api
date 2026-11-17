/** Validated list criteria shared by transports and persistence; no ORM fragments or HTTP metadata. */
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

export type SortDirection = 'asc' | 'desc';
export type LogicalOperator = 'AND' | 'OR';

export type SortItem = { field: string; direction: SortDirection };
export type FilterCondition = { field: string; operator: FilterOperator; value: unknown };
export type FilterGroup = { operator: LogicalOperator; conditions: FilterNode[] };
export type FilterNode = FilterCondition | FilterGroup;

export type ListQueryOptions = {
  /** Zero or one client-selected field; database ordering may append an internal ID tie-breaker. */
  sort: SortItem[];
  filter: FilterGroup;
};
