# Vendure Reference: how a large project is organized

[Vendure](https://github.com/vendurehq/vendure) is a large open-source headless commerce platform on
NestJS. This page records what was read in its source (master branch, checked 2026-10-30), what we
copied, and what we deliberately did not. Only facts seen in the repository are listed.

## 1. Repository and package layout

Monorepo under `packages/`: `core` (the server), `common` (types shared by server and UIs),
`admin-ui`, `dashboard`, `cli`, `create`, `testing`, `dev-server`, `ui-devkit`, and many optional
plugins (`email-plugin`, `asset-server-plugin`, `job-queue-plugin`, `admin-ui-plugin`, `harden-plugin`, ...).

The server `packages/core/src` is organized **by technical layer**, not by feature:

| Folder                                                                                                                 | Role                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`                                                                                                                 | Transport: GraphQL `resolvers/`, `middleware/`, `decorators/`, `schema/`, API config                                                                                        |
| `service/`                                                                                                             | Business logic: `services/` (roughly one per entity or concern) and `helpers/` (shared building blocks such as the list query builder)                                      |
| `entity/`                                                                                                              | Persistence models                                                                                                                                                          |
| `config/`                                                                                                              | `vendure-config.ts`, `default-config.ts` and one folder per **strategy** (`asset-storage-strategy`, `payment`, `shipping-method`, `tax`, `order`, `job-queue`, `auth`, ...) |
| `plugin/`                                                                                                              | Plugin system and built-in plugins                                                                                                                                          |
| `event-bus/`                                                                                                           | Domain events (decouples side effects from services)                                                                                                                        |
| `i18n/`, `job-queue/`, `cache/`, `connection/`, `worker/`, `scheduler/`, `health-check/`, `data-import/`, `telemetry/` | Cross-cutting infrastructure                                                                                                                                                |
| `common/`                                                                                                              | Shared types, errors, decorators (for example `calculated-decorator.ts`)                                                                                                    |

Conventions visible everywhere: tests (`*.spec.ts`) sit **next to** the code they test, public API is
re-exported through `index.ts`, and JSDoc blocks carry `@docsCategory` / `@docsPage` tags that generate
the documentation site (so the reference docs come from code, as in our [ADR 0002](../adr/0002-docs-as-code-with-generated-reference.md)).

## 2. How Vendure builds list queries

All in `packages/core/src/service/helpers/list-query-builder/`:

| File                                                     | Responsibility                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `list-query-builder.ts`                                  | `@Injectable ListQueryBuilder.build(entity, options, extendedOptions)`: orchestrates relations, pagination, sort, filter |
| `parse-sort-params.ts`                                   | validates sort keys against **entity column metadata**, `@Calculated` columns and a `customPropertyMap`                  |
| `parse-filter-params.ts`                                 | validates filters, one operator switch per type, handles nested `_and` / `_or` groups                                    |
| `get-calculated-columns.ts`, `calculated-column-join.ts` | support for computed columns                                                                                             |
| `*.spec.ts` for each parser                              | unit tests                                                                                                               |

The contract (`common/types/common-types.ts`):

```ts
interface ListQueryOptions<T> {
  take?: number | null;
  skip?: number | null;
  sort?: SortParameter<T> | null; // { field: 'ASC' | 'DESC' }
  filter?: FilterParameter<T> | null; // { field: { operator: value }, _and?, _or? }
  filterOperator?: LogicalOperator; // AND (default) | OR
}
```

Operators are typed per data type: `StringOperators` (`eq, notEq, contains, notContains, in, notIn, regex, isNull`),
`NumberOperators` (`eq, lt, lte, gt, gte, between, isNull`), `DateOperators` (`eq, before, after, between, isNull`),
`BooleanOperators` (`eq, isNull`), `ListOperators`.

Behaviours worth copying:

- An invalid sort or filter field throws a `UserInputError` that **lists the valid fields**.
- `take` above the configured limit (`adminListQueryLimit`) is **rejected**, not silently trimmed.
- Computed values are declared with the `@Calculated({ listQuery: { expression | query, relations } })` decorator, so sort/filter work on them.
- Special filters on relations go through a `customPropertyMap`.

## 3. What DebtFlow adopted

| Vendure                                                                                                    | DebtFlow (`src/common/query/`)                                      | Note                                                |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `ListQueryOptions` as the transport-neutral contract                                                       | `ListQueryOptions { sort, filter: FilterGroup }`                    | HTTP parsing and Prisma building are separate steps |
| `parse-sort-params` / `parse-filter-params` / `list-query-builder` split                                   | same three files                                                    | plus `define-list-query`, decorator, pipe, swagger  |
| Operator vocabulary `eq, notEq, contains, notContains, in, notIn, isNull, lt..gte, between, before, after` | same names                                                          | `startsWith`/`endsWith` added; `regex` skipped      |
| `filterOperator` AND/OR and nested groups                                                                  | `filterOperator`; internal tree supports nesting                    | query string stays flat                             |
| `@Calculated`                                                                                              | `computed: true` and `sort` / `filter` hooks on a field             | e.g. party balances                                 |
| Error lists valid fields                                                                                   | `INVALID_SORT` / `INVALID_FILTER_FIELD` / `INVALID_FILTER_OPERATOR` | localized                                           |
| Parser specs next to the code                                                                              | `*.spec.ts` in `src/common/query`, `npm test`                       | pure functions, no database                         |
| Field list derived from entity metadata                                                                    | allow-list **verified** against the Prisma schema at startup        | see below                                           |

### Where we intentionally differ

- **Allow-list instead of "all columns".** Vendure exposes every entity column and relies on its API layer and permissions. Our REST endpoints serve tenant data from shared tables, so each resource declares the exact fields (the security boundary). Prisma's runtime metadata does not include nullability or enum values, so types stay explicit but are cross-checked against the schema at startup.
- **REST, not GraphQL.** Vendure generates `*ListOptions` GraphQL inputs. We express the same options as `sort` / `filter[field][op]` query parameters and document them in OpenAPI.
- **`page`/`pageSize` instead of `skip`/`take`.** Kept for compatibility with the existing frontend; the cap (`MAX_PAGE_SIZE`) is enforced by validation, which rejects rather than trims.

## 4. Lessons for the rest of the project (not done yet)

| Vendure practice                                            | Suggestion for DebtFlow                                                                                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tests next to code, parsers are pure functions              | Keep new shared logic pure and spec-tested; add specs for payment allocation and debt status rules                                      |
| Event bus decouples side effects                            | Publish domain events (`PaymentRecorded`, `DebtCancelled`) and write `AuditLog` rows from a subscriber. Today no code writes audit logs |
| Strategy objects in `config/`                               | Use for things likely to vary per tenant (code generation `CN-YYYYMM-NNNN`, aging buckets)                                              |
| `common` package shared by server and UI                    | Generate frontend types from `docs/generated/openapi.json` instead of hand-copying the envelope and DTOs in `debtflow-web`              |
| One service per concern + `helpers/` for reusable machinery | `src/common/query` is the first such helper; `DebtsService` and `PaymentsService` are the next candidates to split                      |
| Layer-based folders in a platform                           | **Do not copy.** DebtFlow is one product, so feature folders (`modules/protected/<feature>`) stay; shared machinery goes to `common/`   |
| Plugin system                                               | Not needed for a single product; revisit only if third parties must extend the API                                                      |
