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
the documentation site (so the reference docs come from code, as in our [ADR 0002](./0002-docs-as-code-with-generated-reference.md)).

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

| Vendure                                                                                                    | DebtFlow (`src/common/query/`)                                                                  | Note                                                |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `ListQueryOptions` as the transport-neutral contract                                                       | `ListQueryOptions { sort, filter: FilterGroup }` (internal; HTTP uses one `sortBy`/`sortOrder`) | HTTP parsing and Prisma building are separate steps |
| `parse-sort-params` / `parse-filter-params` / `list-query-builder` split                                   | `list-query-sort`, `list-query-filter`, `list-query-builder`                                      | plus `define-list-query`, decorator, pipe, swagger  |
| Operator vocabulary `eq, notEq, contains, notContains, in, notIn, isNull, lt..gte, between, before, after` | same names                                                                                      | `startsWith`/`endsWith` added; `regex` skipped      |
| `filterOperator` AND/OR and nested groups                                                                  | `filterOperator`; internal tree supports nesting                                                | query string stays flat                             |
| `@Calculated`                                                                                              | `computed: true` and `sort` / `filter` hooks on a field                                         | e.g. party balances                                 |
| Error lists valid fields                                                                                   | `INVALID_SORT` / `INVALID_FILTER_FIELD` / `INVALID_FILTER_OPERATOR`                             | localized                                           |
| Parser specs next to the code                                                                              | `*.spec.ts` in `src/common/query/_test/`, targeted Vitest                                                   | pure functions, no database                         |
| Field list derived from entity metadata                                                                    | allow-list **verified** against the Prisma schema at startup                                    | see below                                           |

### Where we intentionally differ

- **Allow-list instead of "all columns".** Vendure exposes every entity column and relies on its API layer and permissions. Our REST endpoints serve tenant data from shared tables, so each resource declares the exact fields (the security boundary). Prisma's runtime metadata does not include nullability or enum values, so types stay explicit but are cross-checked against the schema at startup.
- **One sort field per request.** The public contract is `sortBy` + `sortOrder`, with an internal unique ID tie-breaker. Vendure's richer sort model is not a requirement for DebtFlow.
- **REST, not GraphQL.** Vendure generates `*ListOptions` GraphQL inputs. We express the same options as `sortBy` + `sortOrder` / `filter[field][op]` query parameters and document them in OpenAPI.
- **`page`/`pageSize` instead of `skip`/`take`.** Kept for compatibility with the existing frontend; the cap (`MAX_PAGE_SIZE`) is enforced by validation, which rejects rather than trims.

## 4. Lessons for the rest of the project (not done yet)

| Vendure practice                                            | Suggestion for DebtFlow                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests next to code, parsers are pure functions              | Keep new shared logic pure and spec-tested; add specs for payment allocation and debt status rules                                          |
| Event bus decouples side effects                            | Implemented through `emitAudit` and `AuditLogsListener`; see [Audit Log](../development/audit-log.md). Delivery is currently in-process and best-effort. |
| Strategy objects in `config/`                               | Use for things likely to vary per tenant (code generation `CN-YYYYMM-NNNN`, aging buckets)                                                  |
| `common` package shared by server and UI                    | Generate frontend types from `docs/generated/openapi.json` instead of hand-copying the envelope and DTOs in `debtflow-web`                  |
| One service per concern + `helpers/` for reusable machinery | `src/common/query` is the first such helper; `DebtsService` and `PaymentsService` are the next candidates to split                          |
| Layer-based folders in a platform                           | **Do not copy.** DebtFlow is one product, so feature folders (`modules/<feature>`) stay; shared machinery goes to `common/`                 |
| Plugin system                                               | Not needed for a single product; revisit only if third parties must extend the API                                                          |

## 5. Local source review: AI guidance and dependency boundaries

Reviewed the local Vendure checkout at commit `3ef5fbe70` on 2026-10-31. Reference instructions were
read as examples, not applied as commands to DebtFlow. Files examined:

- `AGENTS.md`: concise development/test guidance, including specific stale-build and e2e-cache gotchas.
- `CONTEXT.md`: small domain vocabulary file; useful when concepts need explicit definitions.
- `.claude/rules/dashboard.md` and `.cursor/rules/dashboard.mdc`: guidance scoped to the dashboard,
  with concrete stack, translation, query and form conventions.
- `skills/vendure-cli/SKILL.md` and `skills/vendure-troubleshooting/SKILL.md`: task-specific entry points
  with references loaded only as needed; troubleshooting starts with sanitized local context.
- `scripts/check-imports.ts`: an executable import check, rather than prose alone.
- `package.json`, `packages/core/package.json`, and core API/service module files: independently
  publishable packages coexist with ordinary Nest modules inside `@vendure/core`.

DebtFlow adopts the short shared entry point, topic routing, narrowly scoped skills, sanitized
diagnostics and automated dependency checks. See [AI Backend Development](../team/ai-development.md).
The API keeps npm, REST/Prisma and feature-owned Nest modules. Vendure's Bun/Lerna tooling, package
release strategy, GraphQL conventions and dashboard UI rules are not requirements for this backend.
The sibling web repository has its own rules and is outside this API change.

## 6. API implementation rules derived from source

The follow-up review traces concrete Customer create/update and Product/Role query/permission flows,
not just the repository layout. See the [30-entry pinned source map](../guides/backend-rules/vendure-source-map.md)
and [mandatory Backend Rules](../guides/backend-rules/index.md). They distinguish observed Vendure behavior
from DebtFlow's REST/Prisma adaptations, give role-specific file names and implementation examples,
and connect each responsibility to executable or behavioral verification. The conventions checker
keeps existing response/query debt visible and disallows adding new violations or security waivers.
