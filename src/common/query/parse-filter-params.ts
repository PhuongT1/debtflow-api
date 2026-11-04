import { badRequest } from '#common/errors/app-errors.js';
import { getBusinessDayRangeForDate } from '#common/utils/business-date.util.js';
import { nest } from './parse-sort-params.js';
import {
  FILTER_OPERATORS,
  isGroup,
  operatorsOf,
  validFieldsOf,
  type FilterCondition,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
  type ListQueryConfig,
  type ListQueryField,
  type LogicalOperator,
  type PrismaFragment,
} from './list-query.types.js';

const FILTER_KEY = /^filter\[([\w.]+)\](?:\[(\w+)\])?$/;
const MAX_LIST_VALUES = 50;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^-?\d+(\.\d+)?$/;

type RawQuery = Record<string, unknown>;
type DayValue = { dayStart: Date; dayEnd: Date };

/** The query keys that belong to the list query and must bypass DTO validation. */
export function isListQueryKey(key: string) {
  return (
    key === 'sortBy' || key === 'sortOrder' || key === 'filterOperator' || FILTER_KEY.test(key)
  );
}

/**
 * Reads `filter[field]=v`, `filter[field][operator]=v` and `filterOperator=AND|OR` from the query
 * string and validates them against the allow-list (Vendure: `parseFilterParams`). The result is a
 * group tree; the HTTP syntax only produces one flat group, but the builder already handles nesting.
 */
export function parseFilterParams(query: RawQuery, config: ListQueryConfig): FilterGroup {
  const conditions: FilterCondition[] = [];

  for (const [key, raw] of Object.entries(query)) {
    const match = FILTER_KEY.exec(key);
    if (!match) continue;

    const [, fieldName, explicitOperator] = match;
    const field = config.fields[fieldName];

    if (
      !Object.hasOwn(config.fields, fieldName) ||
      !field ||
      field.filterable === false ||
      (field.computed && !field.filter)
    ) {
      throw badRequest('query.INVALID_FILTER_FIELD', {
        field: fieldName,
        validFields: validFilterFields(config).join(', '),
      });
    }

    const repeated = Array.isArray(raw);
    const operator = (explicitOperator ?? (repeated ? 'in' : 'eq')) as FilterOperator;
    const allowed = operatorsOf(field);

    if (!FILTER_OPERATORS.includes(operator) || !allowed.includes(operator)) {
      throw badRequest('query.INVALID_FILTER_OPERATOR', {
        field: fieldName,
        operator,
        validOperators: allowed.join(', '),
      });
    }

    const text = repeated ? (raw as unknown[]).map(String).join(',') : String(raw);
    conditions.push({
      field: fieldName,
      operator,
      value: coerce(fieldName, field, operator, text),
    });
  }

  return { operator: parseLogicalOperator(query.filterOperator), conditions };
}

/** Compiles a filter tree to a Prisma `where` fragment, or undefined when there is nothing to filter. */
export function buildWhere(
  group: FilterGroup,
  config: ListQueryConfig,
): PrismaFragment | undefined {
  const parts = group.conditions
    .map((node) => buildNode(node, config))
    .filter((part): part is PrismaFragment => part !== undefined);

  return parts.length > 0 ? { [group.operator]: parts } : undefined;
}

function buildNode(node: FilterNode, config: ListQueryConfig): PrismaFragment | undefined {
  if (isGroup(node)) return buildWhere(node, config);

  const field = config.fields[node.field];

  if (field.filter) return field.filter(node.operator, node.value);

  const path = field.path ?? node.field;

  // Prisma has no negated `contains` on a scalar filter; negate the whole condition instead.
  if (node.operator === 'notContains') {
    return { NOT: nest(path, { contains: node.value, mode: 'insensitive' }) };
  }

  return nest(path, toCondition(node));
}

function validFilterFields(config: ListQueryConfig) {
  return validFieldsOf(config, 'filterable').filter(
    (name) => !config.fields[name].computed || config.fields[name].filter,
  );
}

function parseLogicalOperator(raw: unknown): LogicalOperator {
  if (raw === undefined || raw === '') return 'AND';
  const value = String(raw).toUpperCase();

  if (value !== 'AND' && value !== 'OR') {
    throw badRequest('query.INVALID_FILTER_OPERATOR_GROUP', { value: String(raw) });
  }

  return value;
}

function coerce(name: string, field: ListQueryField, operator: FilterOperator, text: string) {
  const fail = () => badRequest('query.INVALID_FILTER_VALUE', { field: name });

  if (operator === 'isNull') {
    if (text !== 'true' && text !== 'false') throw fail();
    return text === 'true';
  }

  if (operator === 'in' || operator === 'notIn' || operator === 'between') {
    const parts = text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0 || parts.length > MAX_LIST_VALUES) throw fail();
    if (operator === 'between' && parts.length !== 2) throw fail();

    return parts.map((part) => coerceScalar(field, part, fail));
  }

  return coerceScalar(field, text.trim(), fail);
}

type Scalar = string | number | boolean | Date | DayValue;

function coerceScalar(field: ListQueryField, value: string, fail: () => Error): Scalar {
  if (value === '') throw fail();

  switch (field.type) {
    case 'string':
      return value;
    case 'enum':
      if (!field.values?.includes(value)) throw fail();
      return value;
    case 'number': {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw fail();
      return parsed;
    }
    case 'decimal':
      if (!DECIMAL.test(value)) throw fail();
      return value;
    case 'boolean':
      if (value !== 'true' && value !== 'false') throw fail();
      return value === 'true';
    case 'date': {
      if (DATE_ONLY.test(value)) {
        try {
          const { start, end } = getBusinessDayRangeForDate(value);
          return { dayStart: start, dayEnd: end };
        } catch {
          throw fail();
        }
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) throw fail();
      return parsed;
    }
  }
}

const isDay = (value: unknown): value is DayValue =>
  typeof value === 'object' && value !== null && 'dayStart' in value;

const startOf = (value: unknown) => (isDay(value) ? value.dayStart : value);
const endOf = (value: unknown) => (isDay(value) ? value.dayEnd : value);

/** One operator to one Prisma scalar filter. Date-only values mean the whole business day (+07:00). */
function toCondition({ operator, value }: FilterCondition): PrismaFragment {
  switch (operator) {
    case 'eq':
      return isDay(value) ? { gte: value.dayStart, lte: value.dayEnd } : { equals: value };
    case 'notEq':
      return { not: value };
    case 'in':
      return { in: value };
    case 'notIn':
      return { notIn: value };
    case 'contains':
    case 'startsWith':
    case 'endsWith':
      return { [operator]: value, mode: 'insensitive' };
    case 'notContains':
      throw new Error('notContains is handled before toCondition');
    case 'gt':
    case 'after':
      return { gt: endOf(value) };
    case 'gte':
      return { gte: startOf(value) };
    case 'lt':
    case 'before':
      return { lt: startOf(value) };
    case 'lte':
      return { lte: endOf(value) };
    case 'between': {
      const [from, to] = value as unknown[];
      return { gte: startOf(from), lte: endOf(to) };
    }
    case 'isNull':
      return value ? { equals: null } : { not: null };
  }
}
