# Maintainability and reuse contract

Read `.ai/core/architecture/maintainability.md` at repository root before changing providers, DTOs,
types or queries. The
project-specific decisions below specialize it.

## Required DebtFlow layout

Domain ownership comes first: `src/modules/<feature>/`. Keep a single ordinary responsibility at the
feature root with its explicit role suffix. Group related controllers, services, queries, mappers,
types or rules when there are at least two files. DTO, test, public, repository and infrastructure
boundaries remain separate even with one file when needed. DTO/type-only contracts do not require
a separate `public/` forwarding file. Module composition stays at the feature root.
Follow OWN-01; do not add filler files or empty folders to justify a template.

This is a NestJS ownership convention. It does not use Next.js file-based routes. Neither folder
placement nor DTO inheritance grants authorization. Module exports and injection still define provider
ownership; route decorators and service invariants define access.

## Concrete sources to reuse

| Responsibility                      | Source and rule                                                                                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editable debt collection fields     | `debts/dto/update-debt-collection.dto.ts` selects fields from `CreateDebtDto`; keep inherited runtime validators and null semantics                                                                                                                                    |
| Allocated payment input             | `payments/dto/create-allocated-payment.dto.ts` extends `CreatePaymentDto`; do not redefine amount/date/method                                                                                                                                                          |
| Member/user identity response       | `users/dto/user-response.dto.ts` derives related public shapes from `UserSummaryDto`                                                                                                                                                                                   |
| Database result types               | `users/queries/member.select.ts`, `payments/queries/payment.select.ts`, `auth/auth.select.ts`, `parties/infrastructure/queries/party.select.ts` own typed `satisfies Prisma.*Select/Include` projections; `types/` derives `Prisma.*GetPayload` and `Pick`             |
| Request auth context                | `src/auth/types/auth-context.types.ts`; refresh payload derives its shared identity fields                                                                                                                                                                             |
| Response envelope types             | `common/http/api-response.types.ts` reuses the DTO owner; do not create another pagination/error-field definition                                                                                                                                                      |
| Optional text and phone format      | `common/utils/optional-text.util.ts`, `common/validation/phone.constants.ts`; no feature-specific clones                                                                                                                                                               |
| Debt filters for list/report/export | `debts/queries/debt-query.ts`; preserve scope and intersect overlapping constraints                                                                                                                                                                                    |
| Party/member list filters           | `parties/infrastructure/queries/party.query.ts`, `users/queries/users.query.ts`; keep capability allow-lists beside them                                                                                                                                               |
| Payment allocation and debt status  | `payments/payment-allocation.rules.ts` owns allocation/amount checks; `debts/rules/debt-payment.rules.ts` owns state derivation and is exposed through `debts/public/debts.ts`                                                                                         |
| Payment list composition            | `payments/queries/payments.query.ts`; tenant and named filters intersect with shared dynamic filters; retain a unique sort tie-breaker                                                                                                                                 |
| Swagger setup and browser helper    | `common/swagger/swagger.setup.ts` owns the document/routes; `swagger-ui.ts` owns HTML/paths; `swagger-auth.js` owns browser authorization and is linted/tested as an asset. Follow the [owner table](../../development/http/api-and-swagger.md#where-to-make-changes). |
| Public member mapping               | `users/member.mapper.ts`; business role decisions stay in `users/users.rules.ts`                                                                                                                                                                                       |
| XLSX document generation            | `exports/debt-export.service.ts`; controller owns headers, provider owns scoped capped data and workbook                                                                                                                                                               |

Paths without `src/` above are relative to `src/modules/` for domains or `src/` for common infrastructure.
Use these as owners for the matching meaning, not universal templates. Payment audit snapshots need
only their selected fields and must not require a full nested payment response. Party contact writes
use an explicit writable-field projection; never replace it with a spread of request/database data.

## Automated checks and limits

`npm run check:maintainability` parses production TypeScript, excluding generated code and tests.
It rejects misplaced mandatory boundaries, unnecessary one-file folders, unnamed generic root helpers, exported contracts inside
executable services/controllers/guards, importing constants/helpers from another feature's DTO and
exact repeated helper bodies of at least 25 significant tokens. Thin controller delegation is excluded
from clone matching. No duplication baseline is provided.

Equivalent manually declared object shapes of at least three properties are printed for semantic
review, not automatically rejected: two unrelated contracts may have the same fields. The checker
does not recognize every variation of duplicated logic, inherited/inline object shape, or validate
whether two contracts have the same meaning. Review still must trace owners and callers. Regression
fixtures for this gate run in `npm run test:quality`; `npm run check` includes both.

## Audit scope and remaining debt

The maintainability pass inventoried all production TypeScript outside generated code, followed
domain controllers/providers/DTOs and query owners, and scanned exact helper/type duplication. It
grouped domain responsibilities, moved session/profile ownership into the auth domain, derived result
types from selections, consolidated repeated text normalization and list mapping, and moved export
generation out of its controller. `src/auth` now owns only reusable guards, decorators, JWT wiring
and context types; it must not import features. `AuthApiModule` owns `AuthService` and session/profile
controllers; the shared `AuthModule` owns JWT infrastructure and global guards.

Every current JSON handler has a concrete response DTO/envelope description. The conventions baseline
is empty; do not add a waiver for a new or changed handler. DTO annotations document the response;
they do not sanitize output. Money remains serialized as decimal strings.

Party list count, page and balances share a RepeatableRead snapshot. Aggregate sorting is owned
by `parties/infrastructure/sql/party-balance-page.sql.ts`; `party-filter.sql.ts` adapts the canonical Prisma
where subset rather than parsing requests again. Extend its SQL and database regression tests when
adding a Party filter or sort. `partyListSelect(organizationId)` owns the Prisma projection and tenant-scoped relation count.
For Party's strict Clean Architecture pilot, DB payloads derive from the actual select inside
infrastructure; domain data and contracts in `application/` are deliberately ORM-independent. This
is the explicit Party exception to the core prohibition against mirroring generated models: the
contracts have different ownership and money representation. Keep `Pick`/`Partial` reuse within
the core and let the typed adapter verify conversions. Do not replace a core contract with a
Prisma payload/DTO alias. `check:architecture` follows core imports transitively, including type-only
imports, and rejects Nest/HTTP/Prisma dependencies. Other feature conventions are unchanged.
XLSX exports remain capped at 1000 rows, and audit delivery remains best-effort in-process. These are explicit behavior/scale limits, not solved by creating more folders.
Mocked persistence tests do not establish live database isolation, concurrency safety or migration safety.

## Cross-feature calls and API implementation

Provider entry points are named `public/` exports and the owning Nest module. Named exported DTO
classes may be imported directly from `dto/*.dto.ts`; named exported types/interfaces may be imported
with `import type` from `*.types.ts`. These contract owners do not permit importing helper functions,
constants, namespace objects or hidden providers. A one-symbol forwarding barrel is not required.
Controllers, services, mappers, query builders and rules remain private unless explicitly exposed
through a named provider/public contract. Direct DTO/type imports follow the narrow rules above. `public/` describes a TypeScript contract, not anonymous HTTP access. Do not
use `export *`, register another feature's provider again or call this API over HTTP from a service
in the same process. Import the owning module and inject its exported provider. Pure read builders
and response DTOs may be reused through named public exports without a provider import.

- `UsersModule` owns and exports `OrganizationMembersService`; Parties and Debts use its tenant-scoped
  active membership/user/organization check. Callers keep their own localized error semantics.
- `PartiesService.assertActive` owns active party access. Debt creation propagates the same transaction
  client through party/member/product checks, line preparation, code lookup and insert. This does not
  establish safe concurrent sequential-code generation or eliminate all read-check-write races.
- `debts/debt-collection.mapper.ts` owns PATCH mapping: omission keeps state, null clears only
  nullable fields, and collection status cannot be null. Do not replace it with full-record mapping.
- `debts/rules/debt-aging.rules.ts` owns calendar-day ranges for lists, reports and exports. Due today
  is not overdue in Vietnam; yesterday is day 1. No caller may define its own bucket boundaries.
- Dashboard totals/counts and category totals use database aggregates. Recent/top lists remain bounded.
  Do not load all debts or line items merely to compute a sum/count in JavaScript.
- Public scalar response DTOs have an explicit safe contract; related shapes use inherited/mapped
  DTOs. Query result types still derive from Prisma projections, rather than those wire DTOs.

Before adding an API, identify its feature and existing public contracts, trace context to the service,
choose request validation/null rules, state/tenant/related-ID policy, status and response DTO, then add
behavioral tests and regenerate OpenAPI. Test a real validation/HTTP boundary as well as pure helpers.
External API calls belong in an owned integration adapter with deliberate credentials, timeout and
failure behavior; do not put external calls in DTOs, controllers or pure query/rule helpers.

## Party clean-layer ownership

Party's explicit `domain/`, `application/`, `presentation/` and `infrastructure/` layout specializes the
compact default. Keep types with their semantic owner: types used by business rules/entities in Domain only when needed; repository records, use-case inputs,
read models and ports in Application; response fields/DTO metadata in Presentation. Do not merge
these responsibilities into a shared `types` file to reduce the file count. Reuse `Pick`/`Partial`
from the inner contract and infer Prisma payloads in Infrastructure. See [Clean Architecture](../../getting-started/architecture/clean-architecture.md).
