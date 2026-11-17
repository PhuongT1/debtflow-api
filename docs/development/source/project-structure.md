# Project Structure

## Main Folders

```txt
src/
  common/
    dto/
    filters/
    validation/
  config/
  database/
  generated/
    prisma/
  auth/
    auth.module.ts
    decorators/
    guards/
    types/
  modules/
    auth/             # AuthApiModule: session/profile controllers and AuthService
    users/
    parties/
    catalog/
    debts/
    payments/
    dashboard/
    reports/
    exports/
    imports/
    audit-logs/
prisma/
  schema.prisma
  models/
  migrations/
  seed.ts
docs/
  getting-started/, database/, development/, team/, reference/, adr/, generated/
scripts/
.ai/
  core/
  project.json
.codex/
  skills/
```

## Responsibilities

| Folder                 | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/auth`             | JWT wiring, global guards, decorators and request context types.                                     |
| `src/modules`          | Domain-owned Nest modules; `AppModule` composes the application and route decorators declare access. |
| `src/common`           | Shared DTOs, filters, validation helpers.                                                            |
| `src/config`           | Environment validation and config helpers.                                                           |
| `src/database`         | Prisma service and database module.                                                                  |
| `src/generated/prisma` | Generated native ESM Prisma Client. Do not edit manually.                                            |
| `prisma/models`        | Domain Prisma models and enums.                                                                      |
| `prisma/migrations`    | Database migration history.                                                                          |
| `.ai/core`             | Portable NestJS rules and default skills.                                                            |
| `.ai/project.json`     | Project rules, skill sources and reference commands.                                                 |
| `.ai/skills`           | Authored DebtFlow skills installed across clients by `npm run ai:setup`.                             |

## Current Modules

- Auth domain: login/refresh are public; organization switching and profile are authenticated.
- Business domains: Users, Parties, Catalog, Debts, Payments, Dashboard, Reports, Exports, Imports, Audit logs.

## API Auth Layout

Features live at `src/modules/<domain>/`. Access is a route policy, independent of folder placement.
`AppModule` imports the domain modules directly; there are no public/protected grouping modules.

Controllers still use explicit decorators for Swagger and readability:

```txt
@PublicApi()  -> public route
@ProtectedApi() -> route requires Bearer token
```

Auth helpers live in:

```txt
src/auth/decorators/auth-api.decorator.ts
src/auth/auth.module.ts
src/modules/auth/auth.service.ts
src/auth/decorators/current-user.decorator.ts
src/auth/guards/jwt-auth.guard.ts
src/auth/decorators/public.decorator.ts
src/auth/decorators/roles.decorator.ts
src/auth/guards/roles.guard.ts
```

Most controllers are protected. Public APIs should be rare and explicit, usually only login or
health-check style endpoints. Authentication is enforced once by `JwtAuthGuard`; endpoint-level
authorization is declared with `@Roles(...)` and enforced once by `RolesGuard`.

The shared `src/auth/AuthModule` owns JWT infrastructure and global guards; `src/modules/auth/AuthApiModule`
owns `AuthService` and session/profile HTTP routes. Public handlers and self-service member mutations without role restrictions
are reviewed individually in `scripts/quality/backend-route-policy.json`. No directory grants an exception.

## Growth and extension boundaries

The debt feature currently groups its cooperating providers, query builders and nested input:

```text
debts/
  debts.module.ts
  debts.controller.ts
  services/
    debts.service.ts
    debt-line-item.service.ts
  queries/
    debts.list-query.ts
    debt-query.ts
    debt-date-filters.ts
  repositories/debts.repository.ts
  infrastructure/prisma-debts.repository.ts
  _test/
    debts.service.spec.ts
    prisma-debts.repository.spec.ts
    debt-query.spec.ts
  dto/
    create-debt.dto.ts
    update-debt-collection.dto.ts
    query-debts.dto.ts
    items/create-debt-item.dto.ts
```

Collection updates select editable fields from `CreateDebtDto` with Swagger `PickType`; allocated
payments extend `CreatePaymentDto`. Validators and public schema remain inherited. Line-item
and document inputs have distinct meanings and remain separate contracts.

The current layout is one modular NestJS application. Its feature ownership and provider exports
allow focused additions without a new package or framework. Existing dependencies include
Exports → Debts → Payments. Reports reuses the public `debts/queries/debt-query.ts` read-query builder and executes
full-dataset Prisma aggregates directly, without importing the debt/payment controller modules.
Keep dependencies intentional and avoid cycles or consumers
reaching into another feature's private helpers. A new consumer imports the owning Nest module.

`debts/queries/debt-query.ts` owns the shared tenant/base/client-filter composition for both paginated debt lists
and reports; do not duplicate that filter builder. `common/validation/phone.constants.ts` owns the
phone format shared by Party and User DTOs. `require-organization-id.ts` rejects missing scope before
the affected business services reach Prisma; it does not replace authentication or resource checks.

| Change                                         | Structure to prefer                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| A small business capability                    | A focused feature module using the existing root                                       |
| A distinct use case inside a growing feature   | A named service/helper; subfolders only when useful                                    |
| A scheduled task, webhook or worker            | An entry adapter calling the same owned use-case service with explicit trusted context |
| An integration with multiple implementations   | An owned integration adapter/token with an intentional injection boundary              |
| A domain with many separate capabilities       | Child domain modules with explicit exports                                             |
| A real independent package consumer or release | Consider a workspace package and its build/dependency boundary                         |

For example, a feature may evolve toward the following **when those responsibilities exist**:

```text
payments/
  payments.module.ts
  payments.controller.ts
  dto/
  services/
    payments.service.ts
    payment-allocation.service.ts
  queries/
    payment-ledger.query.ts
  integrations/
    payment-gateway.adapter.ts
  jobs/
    payment-reconciliation.service.ts
```

This is an evolution example, not the current tree or a required scaffold. Keep responsibility folders
consistent without creating empty scaffolding; split by responsibility rather than line count. Background callers do not pass through HTTP guards,
so reusing a service also requires preserving actor, tenant, ownership and status checks.

Domain-first ownership keeps public/protected HTTP routes, webhooks and background adapters near the
same business capability. Small domains may register controllers and providers in one module. When
a worker needs only use-case providers, separate that domain's provider module from its HTTP adapter
module and import only the provider module in the worker bootstrap. Do not duplicate providers or
import `AppModule` into reusable domain code. These extension folders/modules are created only for
actual consumers, not as mandatory empty scaffolding.

## Why Vendure has packages at its root

The examined Vendure checkout is a multi-package repository. Its core still has
`packages/core/src/`, containing API, service, connection, event-bus and other subsystems, and its
`packages/core/package.json` describes the published `@vendure/core` package. The root `packages/`
directory and an application's `src/` represent different levels of organization.

Use the lessons about clear ownership, intentional exports, provider lifecycle and extension points.
A `src/` folder does not prevent growth; adding `packages/` alone does not establish those boundaries.
Keep this API's current application layout until an actual independent consumer/release boundary
justifies extracting a package. See the [pinned Vendure source map](../../guides/backend-rules/vendure-source-map.md).

## Composition regression checks

`src/_test/app.module.spec.ts` boots the real compiled Nest graph on an ephemeral localhost port, overriding
Prisma and the exercised business services with sanitized mocks. It checks public login/refresh,
protected reads and organization switching, current-role mutation rejection, tenant/actor forwarding,
unknown-field rejection and response status/envelope. It also composes `PaymentsModule` independently
of the HTTP application. These tests cover wiring/access integration, not live database guarantees.

Run `npm run check`, which builds before running the suite. For a targeted run after source changes,
run `npm run build` before `npx vitest run src/_test/app.module.spec.ts`; the suite intentionally loads compiled
artifacts for Nest constructor metadata and generated Swagger factories. Source layout is additionally
guarded by `check:architecture` and `check:maintainability`, and exact public/member policies by `check:conventions`.

See [Maintainability and reuse](../../guides/backend-rules/maintainability.md) for type ownership, DTO derivation,
query projections, reuse examples and the current audit limits.

## Public feature contracts

Cross-feature providers use `public/` named exports and `*.module.ts`. DTO classes can be imported
by name from their `dto/*.dto.ts` owner; type/interface contracts use named type-only imports from
`*.types.ts`. Do not add a forwarding barrel merely for one data contract. For an injectable provider,
import the owning module as well; importing its class alone does not make it injectable. Do not call
another controller or issue HTTP requests back to this application to reuse a use case. Keep pure
record DTO contracts separate from relation response contracts when that avoids runtime import cycles.
`check:maintainability` rejects private implementation imports, fake DTO functions, helper imports
through DTO/type owners, namespace contract imports and blanket public exports. Tests may reach their subject directly. `public/` is unrelated to HTTP access policy.

`OrganizationMembersService` belongs to Users, active party access belongs to Parties, collection
PATCH mapping, shared aging and debt payment-state derivation belong to Debts. Payments owns
settlement orchestration, and Dashboard owns its aggregation. These owners are the starting points for
changes; do not add a second implementation under a different entry point.

## Party list query ownership

For the full layer map, request/write flows, change checklist and audit gaps, see
[Party implementation example](../../getting-started/architecture/party-architecture.md).

Shared read definitions and PostgreSQL SQL builders have distinct names and dependency boundaries:

```text
parties/
  queries/
    party.list-query.ts                 # public filter/sort capabilities and computed aliases
    party.query.ts                      # canonical Prisma where/orderBy and balance statuses
    party.select.ts                     # shared typed projections and response field keys
  infrastructure/
    prisma-parties.repository.ts        # DB calls, transaction and page hydration
    sql/
      party-balance-page.sql.ts         # aggregate, sort and pagination SQL
      party-filter.sql.ts              # canonical Prisma predicates → SQL fragments
  _test/
    party-balance-page.sql.spec.ts
    party-balance-page.postgres.spec.ts # opt-in PostgreSQL result checks
```

`queries/` owns definitions reused by the controller, DTOs, mapper and repository. `infrastructure/sql/`
is private PostgreSQL implementation. Both build arguments/fragments only; the repository executes
them. Shared payload types derive from the actual projection rather than redeclaring database fields.
`outstandingDocuments` is a legacy sort alias for `_count.debts` (all tenant debts, including paid and
cancelled). It is not a Party column or a separate response property. Balances aggregate only
OPEN/PARTIAL debts. The computed alias registry is shared with a complete typed sort-aggregate map.

`parties/infrastructure/queries/party.query.ts` composes the canonical authorized filters. Ordinary ordering uses
Prisma; aggregate ordering is implemented by `party-balance-page.sql.ts`, which accepts one
`SortItem` and adds the internal ID tie-breaker. There is no multi-sort loop or projection registry.
It reuses the supported Prisma predicate subset adapted by `party-filter.sql.ts`. This adapter is private to Parties, not a
generic query framework. `PrismaPartiesRepository.list` owns the RepeatableRead boundary and bounded page
hydration; `party.select.ts` owns the scoped projection, and payload types derive from it. Keep tests
in the feature's `_test/` folder. There is no separate JavaScript full-result sort or duplicate request parser.

## Payment responsibilities

`payments/payments.service.ts` orchestrates scoped reads, voucher/debt writes in one transaction
and audit after commit. `payments/payment-allocation.rules.ts` owns pure amount/allocation
checks; `payments/queries/payments.query.ts` owns list filters and stable default ordering. Shared
balance-to-status calculation belongs to `debts/rules/debt-payment.rules.ts`, imported only through
`debts/public/debts.ts`. It preserves the existing application/reversal semantics and is not a generic
state-machine framework. These pure helpers need no Nest provider registration or extra module.

Middleware handles HTTP concerns, guards access, pipes validation, interceptors request/response
wrapping, and filters exceptions. Business rules stay with their feature. Add an HTTP middleware,
strategy, queue or provider module only for a concrete responsibility or consumer; Vendure's folder
names and plugin infrastructure are not a reason to add them to every DebtFlow feature.

## Swagger documentation ownership

`common/swagger/swagger.setup.ts` owns OpenAPI creation and documentation route registration.
`swagger-ui.ts` owns the HTML, route constants and pinned Swagger UI assets; `swagger-auth.js` is the
linted browser entry for authorization. `configureApp()` composes this adapter and returns the same
OpenAPI document to the offline documentation generator. Follow the task-to-file table in
[API and Swagger](../http/api-and-swagger.md) rather than adding another setup, token form or copied schema.

Runtime/build ownership: Node 24 + native ESM, TypeScript 6 and Nest 12.
[Import Aliases](./import-aliases.md) defines import syntax; [Run Source](../../getting-started/running/index.md) covers
Vercel, Node and Docker artifacts. `src/generated/list-query/` is schema-generated metadata for
list-query validation and is regenerated together with the Prisma client.

Test placement: all specs and fixtures live in the owner's `_test/` folder. For example,
`parties/_test/` contains service, mapper and query suites together; `common/query/_test/` owns
shared query tests and their helpers. Application composition tests are in `src/_test/`.
Tests do not enter the production build; see the [testing contract](../../guides/backend-rules/testing-completion.md#test-placement).

`.ai/` is the maintained AI workspace: reusable core rules/skills, project-specific skills and the
project manifest. It is intentionally broader than `.ai-rules/`. Client folders remain generated
installations. Rename this workspace only for a concrete requirement and update the installer,
manifest, root guide, client adapters, ignore policy and portability tests together.

## Persistence boundaries

Features with database access keep their existing responsibility folders and add `repositories/`
for abstract contracts and `infrastructure/` for Prisma implementations. Services own use cases and
business decisions; read adapters own database projections. Modules register the implementation
once using `provide`/`useClass`. See [Persistence architecture](../persistence/persistence-architecture.md) for
transaction stores, source references, permitted type dependencies and enforcement.

## Compact ordinary responsibilities

A single controller, service, mapper, query, rule or types file stays at the feature root. Group
related files in a responsibility folder when there are at least two; move the existing file and
its callers together when adding the second. Keep DTO/test/public/repository/infrastructure
boundaries separate even for one file. Party explicitly groups code by clean layer: `domain/`,
`application/` (including `repositories/`), `presentation/` (including `dto/`) and `infrastructure/`.
Only Nest composition and shared outer-adapter list capabilities stay at its root. See OWN-01 for the canonical layout; do not create placeholder files or folders.

Party computed list reads rank the complete filtered set using only the requested sort aggregate,
then compute both response balances for the selected page. Scalar sorts keep paginated Prisma reads.
Mutation snapshots use `PartiesRepository.findRecord` with the scalar projection; update/deactivate
must not fetch the detail endpoint's debt history merely for normalization or audit snapshots.

## Repository scripts

Automation is grouped by responsibility under `scripts/`: `ai/`, `quality/`, `database/`,
`prisma/`, `docs/` and `build/`. Tests stay beside their owned scripts.
Read `scripts/README.md` in the repository for entrypoints, dependencies
and copying tools into another project. Prefer the stable npm commands in the root README.
When adding a command, extend its existing owner and update `package.json` and this documentation;
do not scatter new scripts at the root or add forwarding wrappers at old paths.
