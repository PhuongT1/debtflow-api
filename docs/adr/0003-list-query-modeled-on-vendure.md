# ADR 0003: List query modeled on Vendure's ListQueryBuilder

- Status: accepted
- Date: 2026-10-30

## Context

Each list endpoint filtered and sorted in its own way (`sortBy` enums in one DTO, hand-written `where`
fragments in each service). Every new field or endpoint meant new DTO fields and new service code, and
sorting could not be combined with filters consistently. The team wants a standard that scales the way a
large project does; [Vendure](../guides/vendure-reference.md) was studied for that.

## Decision

- One convention for every list endpoint: single-field `sortBy`+`sortOrder`, `filter[field][operator]`,
  `filterOperator` ([List Query guide](../guides/list-query.md)).
- Adapt Vendure's responsibility split: a `ListQueryOptions` contract, `list-query-sort`,
  `list-query-filter` and `list-query-builder`. Parsing and Prisma compilation share one owner per
  operation; common capability/path helpers live in `list-query.helpers`. Specs live in `_test/`.
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
- Clients select exactly one sort field. The internal unique ID tie-breaker keeps pagination stable.
- The earlier comma-separated `sort` HTTP syntax was removed; old requests are rejected rather than silently ignored.
- Computed Party ordering runs in the owned PostgreSQL aggregate/page query before pagination.
- Nested AND/OR groups are supported by the contract but not yet by the query-string syntax.
