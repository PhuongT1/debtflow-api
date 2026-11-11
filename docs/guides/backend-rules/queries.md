# List queries, pagination and data volume

Vendure centralizes list parsing/building, scopes queries and limits requests; Product/Customer add
resource-specific relation mappings and Role filters visibility before pagination (V02–V03, V12,
V17–V18). DebtFlow's list-query contract is the REST adaptation, not an open Prisma query endpoint.

## QRY-01 — one parser, one capability list per resource

MUST declare `defineListQuery({ model, fields })` in `<feature>.list-query.ts`. Set each exposed field's
type, enum values, nullability and filter/sort capabilities deliberately. `path`, computed fields and
hooks are explicit mappings, not user-controlled expressions. The runtime Prisma metadata check
detects model/path/type mistakes, but does not infer all enum values/nullability or business exposure.

Bind the existing `@ListQuery(CONFIG)` and `@ApiListQuery(CONFIG)` in the controller, use a real query
DTO for remaining resource-specific parameters, and call `applyListQuery` with a trusted base `where`.
Use only the shared single-field `sortBy`/`sortOrder` HTTP contract. Do not add a `sort` parameter,
comma-separated/repeated sort fields, another operator parser or a field allow-list in a service. Do not
copy all database columns into a public list definition; tenant IDs, credentials and internal metadata
do not become queryable merely because they exist.

## QRY-02 — pagination applies to the complete authorized ordering

Count and fetch MUST use the same final authorized `where`. Use bounded `pageSize`, validated positive
integer pagination and a unique tie-breaker in the final order so duplicate values do not shuffle
pages. The client selects exactly one field; preserve its direction and null behavior. Keep the unique
ID tie-breaker internal to database ordering. Permission/visibility filters belong before slicing, not after fetching one page.

Computed balance sorts require the value before pagination and must honor the selected field and
its internal ID tie-breaker. Do not sort only the current page or replace the requested field with
the default order. Party uses a tenant-scoped PostgreSQL aggregate/page query for balance and
document-count sorts,
then hydrates only the selected IDs. Reuse its canonical filter builder; the private SQL adapter
supports only the predicates produced by that feature and rejects unknown predicates. Count, rows
and balances use one short RepeatableRead transaction. Do not reintroduce full-result JavaScript
sorting. Database aggregation still processes matching debts; measure realistic query plans before
promising a latency target or introducing a summary projection with its own freshness contract.

## QRY-03 — dates, relations and SQL are deliberate

Date-only filters represent Vietnam business days; timestamps represent the documented instant.
Reject impossible dates, invalid ranges, malformed booleans/numbers/enums, unsupported operators,
excessive sort/list values and unknown fields with the shared 400 error contract. A literal `"false"`
must not become true through JavaScript truthiness.

Load only relations/fields required for the public response. Avoid N+1 lookups inside list loops:
batch related IDs/aggregates or use deliberately selected joins/includes, always tenant-scoped. Do
not join every relation by default or copy Vendure's GraphQL relation selection into REST without
actual caller needs. A calculated sort/filter needs tests proving its semantics and pagination.

Build scalar conditions with explicit typed assignments. Avoid long conditional-spread chains and
unnecessary enum assertions. Keep relation/date construction in named query functions. Conditions
targeting the same field MUST intersect through AND rather than overwrite each other by object spread;
this includes named status, outstanding, overdue, exact-date, date-range and dynamic client filters.
Keep the trusted tenant outside client-controlled OR groups. Group these files under `queries/`.

## QRY-04 — exports/reports are not ordinary pages

MUST decide whether an export/report means all matching data or a capped window. If reusing the list
use case, do not silently inherit one page or `MAX_PAGE_SIZE` and label the result complete. For all
data use an explicit bounded batch/cursor strategy or database aggregate, preserving permissions,
tenant/filter conditions and deterministic progress. Document caps, CSV/XLSX representation and
large-result behavior, and check more-than-one-page data in a real applicable test.

**Acceptance:** same-scope count/items, foreign-tenant exclusion including OR, unknown field/operator
rejection, default/single-field/stable sort, duplicate/null values, cross-page computed results, strict
dates and the declared export/report volume semantics. Existing capped reports/exports are not a
template for silently complete-data claims.


## Party field definitions and navigation

Party's query configuration uses generated `Prisma.PartyScalarFieldEnum` references for DB scalar
keys. Computed sort aliases are declared once in `PARTY_COMPUTED_SORT_FIELDS` in `party.list-query.ts`
with comments naming their actual data source. Config keys and SQL expressions must reference those
symbols rather than repeating string literals. The SQL sort-aggregate mapping must cover every computed alias via
`Record<PartyComputedSortField, ...>` with its expression and debt-type constraint. A computed flag alone is not a source definition.
Keep `computed: true` and `filterable: false` on this sort-only contract. Do not rename public query
parameters or change their counting/status semantics incidentally when improving names/navigation.

## Party Prisma/SQL synchronization

`buildPartyQuery` is the sole owner of tenant, named and dynamic filters. Pass its final `where`
to both count/findMany and the private SQL adapter; never rebuild request filters in SQL separately.
`PARTY_BALANCE_STATUSES` in `party.query.ts` owns eligible balance statuses for the balance-type
filter, Prisma aggregation and SQL aggregation. Document count intentionally keeps its all-debt semantics.

When adding a Party filter/operator/sort, extend the existing SQL boundary suite. It walks the actual
capability configuration and shared `getAllowedFilterOperators`, including AND/OR, so unsupported additions fail
before release. Column names are checked against Prisma's generated scalar enum. These checks prove
adapter coverage, not SQL/Prisma result equivalence; changes to SQL semantics need the relevant
PostgreSQL comparison scenarios under the normal database-verification approval policy.

For Party computed sorts, aggregate only the requested direction/count across all matched parties,
then select the ordered page. Compute both response balances from debts belonging to that page.
Retain the same tenant/status rules, zero balance behavior and ID tie-breaker. Do not compute both
balance directions over the full result solely to decorate one page. This reduces aggregate work;
latency improvements still require measurements on representative data.

## Reuse ordinary sorting

For DB columns, declare the field type once in the resource list-query configuration and use the
shared `@ListQuery` / `applyListQuery` path. Do not create per-feature date/text/number sorting helpers
or load all rows to sort in JavaScript. Default ordering must include a unique tie-breaker. Preserve
PostgreSQL null/collation/enum ordering unless the endpoint explicitly defines and tests a different
contract. Calendar-day-only, natural text and computed aggregate ordering are deliberate custom
requirements, not automatic effects of declaring `type: 'date'` or `type: 'string'`.

Shared query ownership: `list-query-sort.ts` owns sort parsing and Prisma order compilation;
`list-query-filter.ts` owns filter parsing/coercion and Prisma predicate compilation;
`list-query.helpers.ts` owns the capability lookups and nested path construction shared by both.
`list-query.types.ts` contains contract types/operator constants, not executable helper functions.
Use explicit names such as `buildPrismaOrderBy`, `buildPrismaWhere`, `buildNestedPath` and
`isFilterGroup`; do not import a filter's generic helper from the sort module or vice versa.
