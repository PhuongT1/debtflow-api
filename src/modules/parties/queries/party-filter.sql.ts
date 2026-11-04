import { Prisma } from '@generated/prisma';

// Only this feature's canonical PartyWhereInput subset is supported. Values are always bound.
const COLUMNS = {
  id: Prisma.sql`p."id"`,
  organizationId: Prisma.sql`p."organizationId"`,
  name: Prisma.sql`p."name"`,
  code: Prisma.sql`p."code"`,
  type: Prisma.sql`p."type"`,
  phone: Prisma.sql`p."phone"`,
  email: Prisma.sql`p."email"`,
  taxCode: Prisma.sql`p."taxCode"`,
  provinceCode: Prisma.sql`p."provinceCode"`,
  provinceName: Prisma.sql`p."provinceName"`,
  creditLimit: Prisma.sql`p."creditLimit"`,
  isActive: Prisma.sql`p."isActive"`,
  assignedToId: Prisma.sql`p."assignedToId"`,
  createdAt: Prisma.sql`p."createdAt"`,
  updatedAt: Prisma.sql`p."updatedAt"`,
  searchText: Prisma.sql`p."searchText"`,
};

type ValueKind =
  'text' | 'numeric' | 'boolean' | 'timestamp' | 'PartyType' | 'DebtType' | 'DebtStatus';

const VALUE_KINDS: Partial<Record<keyof typeof COLUMNS, ValueKind>> = {
  type: 'PartyType',
  creditLimit: 'numeric',
  isActive: 'boolean',
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
};

export function partyColumn(field: string): Prisma.Sql {
  if (!Object.hasOwn(COLUMNS, field)) throw new Error('Unsupported Party SQL column');
  return COLUMNS[field as keyof typeof COLUMNS];
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Date)
    throw new Error('Unsupported Party SQL predicate');
  return value as Record<string, unknown>;
}

function bound(value: unknown, kind: ValueKind): Prisma.Sql {
  if (!(
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    Prisma.Decimal.isDecimal(value)
  ))
    throw new Error('Unsupported Party SQL value');
  const parameter =
    value instanceof Date
      ? value.toISOString()
      : Prisma.Decimal.isDecimal(value)
        ? value.toString()
        : value;
  switch (kind) {
    case 'numeric':
      return Prisma.sql`${parameter}::numeric`;
    case 'boolean':
      return Prisma.sql`${parameter}::boolean`;
    case 'timestamp':
      return Prisma.sql`${parameter}::timestamp`;
    case 'PartyType':
      return Prisma.sql`${parameter}::"PartyType"`;
    case 'DebtType':
      return Prisma.sql`${parameter}::"DebtType"`;
    case 'DebtStatus':
      return Prisma.sql`${parameter}::"DebtStatus"`;
    default:
      return Prisma.sql`${parameter}::text`;
  }
}

function and(parts: Prisma.Sql[]) {
  return parts.length ? Prisma.sql`(${Prisma.join(parts, ' AND ')})` : Prisma.sql`TRUE`;
}

function scalar(column: Prisma.Sql, input: unknown, kind: ValueKind): Prisma.Sql {
  if (input === null) return Prisma.sql`${column} IS NULL`;
  if (typeof input !== 'object' || input instanceof Date || Prisma.Decimal.isDecimal(input))
    return Prisma.sql`${column} = ${bound(input, kind)}`;
  const filter = object(input);
  if (filter.mode !== undefined && filter.mode !== 'default' && filter.mode !== 'insensitive')
    throw new Error('Unsupported Party SQL query mode');
  if (
    filter.mode === 'insensitive' &&
    Object.keys(filter).some((key) => !['mode', 'contains', 'startsWith', 'endsWith'].includes(key))
  )
    throw new Error('Unsupported Party SQL insensitive comparison');
  const parts: Prisma.Sql[] = [];
  for (const [operator, value] of Object.entries(filter)) {
    if (value === undefined || operator === 'mode') continue;
    switch (operator) {
      case 'equals':
        parts.push(
          value === null
            ? Prisma.sql`${column} IS NULL`
            : Prisma.sql`${column} = ${bound(value, kind)}`,
        );
        break;
      case 'not':
        parts.push(Prisma.sql`NOT (${scalar(column, value, kind)})`);
        break;
      case 'in':
      case 'notIn': {
        if (!Array.isArray(value)) throw new Error('Unsupported Party SQL list value');
        const condition = value.length
          ? Prisma.sql`${column} IN (${Prisma.join(value.map((item) => bound(item, kind)))})`
          : Prisma.sql`FALSE`;
        parts.push(operator === 'notIn' ? Prisma.sql`NOT (${condition})` : condition);
        break;
      }
      case 'gt':
        parts.push(Prisma.sql`${column} > ${bound(value, kind)}`);
        break;
      case 'gte':
        parts.push(Prisma.sql`${column} >= ${bound(value, kind)}`);
        break;
      case 'lt':
        parts.push(Prisma.sql`${column} < ${bound(value, kind)}`);
        break;
      case 'lte':
        parts.push(Prisma.sql`${column} <= ${bound(value, kind)}`);
        break;
      case 'contains':
      case 'startsWith':
      case 'endsWith': {
        if (kind !== 'text' || typeof value !== 'string')
          throw new Error('Unsupported Party SQL pattern');
        const pattern =
          (operator === 'endsWith' || operator === 'contains' ? '%' : '') +
          value +
          (operator === 'startsWith' || operator === 'contains' ? '%' : '');
        parts.push(
          filter.mode === 'insensitive'
            ? Prisma.sql`${column} ILIKE ${pattern}`
            : Prisma.sql`${column} LIKE ${pattern}`,
        );
        break;
      }
      default:
        throw new Error('Unsupported Party SQL scalar operator');
    }
  }
  return and(parts);
}

function debtExists(input: unknown): Prisma.Sql {
  const relation = object(input);
  if (Object.keys(relation).length !== 1 || !Object.hasOwn(relation, 'some'))
    throw new Error('Unsupported Party SQL relation');
  const conditions: Prisma.Sql[] = [];
  for (const [field, value] of Object.entries(object(relation.some))) {
    if (value === undefined) continue;
    if (field === 'type')
      conditions.push(scalar(Prisma.sql`related_debt."type"`, value, 'DebtType'));
    else if (field === 'status')
      conditions.push(scalar(Prisma.sql`related_debt."status"`, value, 'DebtStatus'));
    else if (field === 'organizationId')
      conditions.push(scalar(Prisma.sql`related_debt."organizationId"`, value, 'text'));
    else throw new Error('Unsupported Party SQL related predicate');
  }
  return Prisma.sql`EXISTS (SELECT 1 FROM "Debt" related_debt WHERE related_debt."partyId" = p."id" AND related_debt."organizationId" = p."organizationId" AND ${and(conditions)})`;
}

/** Adapt the already composed, scoped Prisma predicate; do not parse request filters again. */
export function partyWhereSql(where: Prisma.PartyWhereInput): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const [field, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (field === 'AND' || field === 'OR' || field === 'NOT') {
      const children = (Array.isArray(value) ? value : [value]).map((item) =>
        partyWhereSql(object(item)),
      );
      if (field === 'AND') parts.push(and(children));
      else if (field === 'OR')
        parts.push(
          children.length ? Prisma.sql`(${Prisma.join(children, ' OR ')})` : Prisma.sql`FALSE`,
        );
      else parts.push(and(children.map((child) => Prisma.sql`NOT (${child})`)));
    } else if (field === 'debts') parts.push(debtExists(value));
    else {
      const kind = VALUE_KINDS[field as keyof typeof COLUMNS] ?? 'text';
      parts.push(scalar(partyColumn(field), value, kind));
    }
  }
  return and(parts);
}
