# ADR 0003: List query modeled on Vendure's ListQueryBuilder

- Status: accepted
- Date: 2026-10-30

## Context

Each list endpoint filtered and sorted in its own way (`sortBy` enums in one DTO, hand-written `where`
fragments in each service). Every new field or endpoint meant new DTO fields and new service code, and
sorting could not be combined with filters consistently. The team wants a standard that scales the way a
large project does; [Vendure](../guides/vendure-reference.md) was studied for that.

## Decision

- One convention for every list endpoint: `sort` / `sortBy`+`sortOrder`, `filter[field][operator]`,
  `filterOperator` ([List Query guide](../guides/list-query.md)).
- Split like Vendure: a transport-neutral `ListQueryOptions` contract, `parse-sort-params`,
  `parse-filter-params` and `list-query-builder`; pure functions covered by specs next to the code.
- Operators are derived from the field type and use Vendure's names.
- Each resource declares an **allow-list** (`*.list-query.ts`), verified against the Prisma schema at
  startup. Computed fields use `computed` or `sort`/`filter` hooks (Vendure's `@Calculated`).
- Services keep ownership of tenant scoping: they pass their own `where` and the client filters are
  ANDed to it through `applyListQuery`.

## Consequences

- Adding a field is one line; adding an endpoint is a definition plus three short lines (controller, service).
- Existing named parameters (`q`, `status`, `aging`, ...) and the web's `sortBy`/`sortOrder` for parties keep working.
- A field must be declared to be usable; this is deliberate (security, indexes).
- `sortBy` and `sortOrder` are consumed by the generic parser, so resource DTOs must not redeclare them.
- Sorting on a computed field only supports that field as the primary sort; any further sort fields are ignored by the service that implements it.
- Nested AND/OR groups are supported by the contract but not yet by the query-string syntax.
