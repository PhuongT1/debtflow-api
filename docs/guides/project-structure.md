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
  README.md, 01-04 pages, guides/, adr/, generated/
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
| `src/generated/prisma` | Generated Prisma Client. Do not edit manually.                                                       |
| `prisma/models`        | Domain Prisma models and enums.                                                                      |
| `prisma/migrations`    | Database migration history.                                                                          |
| `.ai/core`             | Portable NestJS rules and default skills.                                                            |
| `.ai/project.json`     | Project rules, skill sources and reference commands.                                                 |
| `.codex/skills`        | Authored DebtFlow skills installed across clients by `npm run ai:setup`.                             |

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
src/modules/auth/services/auth.service.ts
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
are reviewed individually in `scripts/backend-route-policy.json`. No directory grants an exception.

## Growth and extension boundaries

The debt feature currently groups its cooperating providers, query builders and nested input:

```text
debts/
  debts.module.ts
  controllers/debts.controller.ts
  services/
    debts.service.ts
    debts.service.spec.ts
    debt-line-item.service.ts
  queries/
    debts.list-query.ts
    debt-query.ts
    debt-query.spec.ts
    debt-date-filters.ts
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
  controllers/payments.controller.ts
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
justifies extracting a package. See the [pinned Vendure source map](./backend-rules/vendure-source-map.md).

## Composition regression checks

`src/app.module.spec.ts` boots the real compiled Nest graph on an ephemeral localhost port, overriding
Prisma and the exercised business services with sanitized mocks. It checks public login/refresh,
protected reads and organization switching, current-role mutation rejection, tenant/actor forwarding,
unknown-field rejection and response status/envelope. It also composes `PaymentsModule` independently
of the HTTP application. These tests cover wiring/access integration, not live database guarantees.

Run `npm run check`, which builds before running the suite. For a targeted run after source changes,
run `npm run build` before `npx vitest run src/app.module.spec.ts`; the suite intentionally loads compiled
artifacts for Nest constructor metadata and generated Swagger factories. Source layout is additionally
guarded by `check:architecture` and `check:maintainability`, and exact public/member policies by `check:conventions`.

See [Maintainability and reuse](./backend-rules/maintainability.md) for type ownership, DTO derivation,
query projections, reuse examples and the current audit limits.

## Public feature contracts

Cross-feature imports use `public/` named exports and `*.module.ts`. For an injectable provider,
import the owning module as well; importing its class alone does not make it injectable. Do not call
another controller or issue HTTP requests back to this application to reuse a use case. Keep pure
record DTO contracts separate from relation response contracts when that avoids runtime import cycles.
`check:maintainability` rejects imports/re-exports into another feature's private folders and blanket
public exports. Tests may reach their subject directly. `public/` is unrelated to HTTP access policy.

`OrganizationMembersService` belongs to Users, active party access belongs to Parties, collection
PATCH mapping and shared aging rules belong to Debts, settlement state transitions remain owned by
Payments, and dashboard aggregation belongs to Dashboard. These owners are the starting points for
changes; do not add a second implementation under a different entry point.
