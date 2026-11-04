# List Query: Pagination, Sort and Filter

Every list endpoint (`GET /debts`, `/parties`, `/payments`, `/users`, `/audit-logs`, plus
`/reports/aging` and `/exports/debts`) understands the **same** query convention. A resource only
declares which fields are allowed; sorting and filtering are not written per endpoint.

`GET /reports/aging` uses the same filters across the complete matching tenant dataset. It accepts
validated pagination/sort parameters for compatibility, but they do not limit or order aggregate
totals. `GET /exports/debts` remains an explicitly capped export of up to 1000 rows.

The design follows Vendure's `ListQueryBuilder` (see [Vendure reference](./vendure-reference.md) and
[ADR 0003](../adr/0003-list-query-modeled-on-vendure.md)).

## Syntax

Named and dynamic filters are additive. Multiple constraints on status or due date intersect; one
does not replace another. Contradictory filters yield no rows. Named `dueDate`, `dueDateFrom` and
`dueDateTo` use valid `YYYY-MM-DD` Vietnam dates; impossible or reversed dates return 400.

| Purpose  | Query string                                     | Meaning                                                                        |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Page     | `page=2&pageSize=20`                             | `pageSize` max 1000, default 20                                                |
| Sort     | `sortBy=dueDate&sortOrder=desc`                  | Exactly one field. `sortOrder` is `asc` (default) or `desc`, case-insensitive. |
| Filter   | `filter[status]=OPEN`                            | equals                                                                         |
| Operator | `filter[originalAmount][gte]=1000000`            | `filter[field][operator]=value`                                                |
| Many     | `filter[status][in]=OPEN,PARTIAL`                | comma separated (also `filter[status]=A&filter[status]=B`)                     |
| Range    | `filter[dueDate][between]=2026-09-01,2026-09-30` | inclusive, exactly two values                                                  |
| Nullable | `filter[assignedToId][isNull]=true`              | only fields marked nullable                                                    |
| Combine  | `filterOperator=OR`                              | how the `filter[...]` conditions combine: `AND` (default) or `OR`              |

No `sortBy` means the endpoint's own default order (debts: newest first, or due date when `overdue=true`;
payments: `paidAt` desc; parties: name). A unique `id` tie-breaker is appended to every explicit sort so
pages are stable when the sorted column has duplicates. Clients select one field only; `id` is
an internal tie-breaker. The old `sort` parameter is rejected as an unknown query field. Comma-separated,
repeated, prefixed or object-valued `sortBy` inputs are rejected with 400.

Brackets must be URL-encoded by clients that do not do it automatically (`filter%5Bstatus%5D=OPEN`);
`curl` needs `-g`. Filters are additive to the endpoint's named parameters (`q`, `type`, `aging`, ... on
`GET /debts`), which keep working. Whatever the client sends is always combined with the service's own
conditions (the tenant `organizationId`) using `AND`.

## Operators are derived from the field type

Names follow Vendure's operator vocabulary.

| Type      | Operators                                                                                   | Value format                                                                 |
| --------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `string`  | `eq`, `notEq`, `in`, `notIn`, `contains`, `notContains`, `startsWith`, `endsWith`, `isNull` | text; the `contains`/`startsWith`/`endsWith` family is case-insensitive      |
| `enum`    | `eq`, `notEq`, `in`, `notIn`, `isNull`                                                      | one of the enum values (case-sensitive)                                      |
| `number`  | `eq`, `notEq`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `between`, `isNull`                 | number                                                                       |
| `decimal` | same as `number`                                                                            | decimal string, e.g. `1250000.50` (no exponent)                              |
| `date`    | `eq`, `lt`, `lte`, `gt`, `gte`, `before`, `after`, `between`, `isNull`                      | `YYYY-MM-DD` (a whole business day in `+07:00`) or a full ISO 8601 timestamp |
| `boolean` | `eq`, `notEq`, `isNull`                                                                     | `true` / `false`                                                             |

`isNull` exists only on fields declared `nullable`. For date-only values `eq` matches the whole day,
`gte`/`after`-side bounds start at 00:00 and `lte`/`between` end at 23:59:59.999 Vietnam time, so
`filter[dueDate][lte]=2026-09-30` includes the 30th. `before` is strictly earlier than the start of the day,
`after` strictly later than its end.

## Errors

Using something that is not allowed fails with `400`. The message lists what is valid, localized
(see [Localization](./localization.md)):

| Code                            | When                                                              | Extra info in the message |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------- |
| `INVALID_SORT`                  | sort field not declared / not sortable                            | valid sort fields         |
| `INVALID_SORT_ORDER`            | `sortOrder` is not asc/desc                                       |                           |
| `INVALID_FILTER_FIELD`          | field not declared / not filterable / computed                    | valid filter fields       |
| `INVALID_FILTER_OPERATOR`       | operator does not belong to the field's type                      | valid operators           |
| `INVALID_FILTER_OPERATOR_GROUP` | `filterOperator` is not AND/OR                                    |                           |
| `INVALID_FILTER_VALUE`          | value cannot be parsed (bad enum, number, date, > 50 list values) |                           |

The allow-list is the security boundary: `organizationId`, password hashes and any column that is not
declared can never be filtered or sorted on.

## What each endpoint allows

Each endpoint's allowed fields, their type and whether they can be sorted are listed in the generated
[API Reference](../generated/api-reference.md) (parameters `sortBy`, `sortOrder`,
`filterOperator` and `filter[...]`) and in Swagger UI. Resource definitions live next to their module:

| Endpoint                                         | Definition                                                |
| ------------------------------------------------ | --------------------------------------------------------- |
| `GET /debts`, `/reports/aging`, `/exports/debts` | `src/modules/debts/queries/debts.list-query.ts`           |
| `GET /parties`                                   | `src/modules/parties/queries/parties.list-query.ts`       |
| `GET /payments`                                  | `src/modules/payments/queries/payments.list-query.ts`     |
| `GET /users`                                     | `src/modules/users/queries/users.list-query.ts`           |
| `GET /audit-logs`                                | `src/modules/audit-logs/queries/audit-logs.list-query.ts` |

## Extending it

### Add a field to a resource

One line in the resource's `*.list-query.ts`:

```ts
fields: {
  // ...
  taxCode: { type: 'string', nullable: true },          // filter + sort, operators from the type
  partyName: { type: 'string', path: 'party.name' },     // through a to-one relation
  note: { type: 'string', sortable: false },             // filter only
  isActive: { type: 'boolean', filterable: false },      // sort only
}
```

The `model` of the definition is checked against the Prisma schema when the app starts: a field or
relation path that does not exist, or a `type` that does not match the column (`decimal` vs `String`),
throws immediately instead of at the first request.

### Derived and custom fields (Vendure's `@Calculated`)

| Case                                            | How                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma can order/filter it with a custom clause | `sort: (direction) => ({ debts: { _count: direction } })` and/or `filter: (operator, value) => ({...})`                                                                                                                                                   |
| Not a database value (e.g. party balances)      | `computed: true`. It is accepted by `sortBy`, no `orderBy` is generated, and the feature reads `listQuery.sort` to implement the complete ordering (see `PartiesService.list`). Computed fields cannot be filtered unless they also have a `filter` hook. |

`GET /parties` marks `outstandingDocuments`, `receivable` and `payable` as computed, so
`sortBy=receivable&sortOrder=desc` keeps working exactly as before.

When a Party sort includes a balance or document count, PostgreSQL aggregates matching tenant debts
and applies the selected field before LIMIT/OFFSET (for example
`sortBy=receivable&sortOrder=desc`). A unique id resolves ties internally. Only the selected page of IDs/balances and its
hydrated records leave the database. Ordinary sorts remain paginated by Prisma; their balances are
aggregated for page IDs only. Both paths use the same canonical authorized `where` for count/items
and one RepeatableRead transaction for count, rows and balances.

Text/enum/null ordering follows PostgreSQL on both paths (ASC NULLS LAST, DESC NULLS FIRST).
This replaces the old JavaScript locale comparison on balance sorts; text ordering follows the
database collation. Balances include OPEN/PARTIAL debts only, use exact Decimal arithmetic, and
keep parties without debts at zero. `balanceType` filters parties without excluding their opposite
balance. `outstandingDocuments` preserves its existing meaning: all tenant-owned debts, including
PAID/CANCELLED. It does not mean only unsettled documents.

The private SQL adapter supports the canonical Party predicate subset, binds all values and uses
fixed column/operator expressions. It rejects unsupported predicates. Changes to Party capabilities
must extend the SQL coverage as well as the shared parser. See [database tests and indexes](./database-workflow.md#party-list-indexes-and-disposable-database-tests).
A snapshot is consistent within one request; separate page requests can observe later commits.
Aggregating matching debts and large OFFSETs still cost database work; bounded API memory does not
imply constant-time queries.

Date-only filters reject impossible calendar dates (such as February 30). Party `createdFrom` and
`createdTo` also use Vietnam business-day boundaries regardless of the server timezone; explicit
dates take precedence over the `createdRange` shortcut.

### Add a new operator

1. Add the name to `FILTER_OPERATORS` and to the right types in `OPERATORS_BY_TYPE` (`list-query.types.ts`).
2. Map it in `toCondition` (`parse-filter-params.ts`) and add a case to `parse-filter-params.spec.ts`.
3. The Swagger description and the error message pick it up automatically.

### Add a new list endpoint

```ts
// products.list-query.ts
export const PRODUCT_LIST_QUERY = defineListQuery({
  model: 'Product',
  fields: {
    name: { type: 'string' },
    code: { type: 'string' },
    categoryId: { type: 'string', sortable: false },
    createdAt: { type: 'date' },
  },
});

// products.controller.ts
@ApiListQuery(PRODUCT_LIST_QUERY)
@Get()
list(
  @CurrentUser() user: JwtAuthPayload,
  @Query() query: QueryProductsDto,
  @ListQuery(PRODUCT_LIST_QUERY) listQuery: ListQueryResult,
) {
  return this.products.list(user.organizationId, query, listQuery);
}

// products.service.ts: keep the tenant condition in the base `where`
const { where, orderBy } = applyListQuery<Prisma.ProductWhereInput, Prisma.ProductOrderByWithRelationInput[]>(
  listQuery,
  { where: { organizationId }, orderBy: [{ name: 'asc' }] },
);
this.prisma.product.findMany({ where, orderBy, skip, take });
```

### Beyond flat AND/OR (nested groups)

The internal contract is a tree (`FilterGroup { operator, conditions: Array<FilterCondition | FilterGroup> }`,
like Vendure's `_and`/`_or`), and `buildWhere` already handles nesting. Only the query-string syntax is
flat today. A future transport (GraphQL, a JSON `filter` body) can produce nested groups without touching
the builder.

## Code layout

```text
src/common/query/
  list-query.types.ts        contract: operators, ListQueryField, ListQueryOptions, FilterGroup
  define-list-query.ts       defineListQuery + startup check against the Prisma schema
  parse-sort-params.ts       sort / sortBy+sortOrder -> SortItem[] -> Prisma orderBy
  parse-filter-params.ts     filter[...] + filterOperator -> FilterGroup -> Prisma where
  list-query-builder.ts      parseListQuery (pure) and applyListQuery (merge with service args)
  list-query.decorator.ts    @ListQuery(config) parameter decorator
  list-query.pipe.ts         validation pipe that lets these keys through DTO validation
  list-query.swagger.ts      @ApiListQuery(config) OpenAPI documentation
  *.spec.ts                  unit tests next to the code (npm test)
```

Parsing and building are pure functions with no database or Nest dependency, which is why they are
covered by plain unit tests.
