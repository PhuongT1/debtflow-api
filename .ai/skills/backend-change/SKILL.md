---
name: backend-change
description: Implement or fix DebtFlow API NestJS endpoints, services, validation, list queries, persistence, and audit behavior. Use for backend feature or bug-fix work in this repository; not for review-only, commit-only, frontend, or unrelated document tasks.
---

# DebtFlow backend change

Follow the repository's `AGENTS.md`. Before implementation, read `docs/guides/backend-rules/index.md`
and the required topic sections for the current change. Those documents own the implementation
contract; this skill selects and applies it rather than maintaining a second copy of the rules.

## Select implementation rules before creating files

- Providers, DTOs, types or queries: `.ai/core/architecture/maintainability.md` and project
  `maintainability.md`. Search existing contracts/helpers and trace callers before defining another
  shape; choose runtime DTO reuse, generated payload derivation or inference as appropriate.
- Constants or file moves: read `ownership-naming.md` (including constant ownership), search existing
  definitions/callers and choose the existing owner before adding a folder or file.
- Before adding a folder: keep a single ordinary responsibility at the feature root; group at two
  related files. DTO/test/public/repository/infrastructure boundaries stay separate. See OWN-01.
- New file/feature: `ownership-naming.md` (owner, kebab-case role suffix, DTO/class names, Nest wiring).
- Route/input/output: `http-contract.md` and `validation.md` (runtime DTO imports, null/blank semantics,
  status/envelope, validation/error contracts, binary exceptions).
- Auth or related IDs: `security-tenancy.md` (current identity, roles, tenant/resource ownership).
- Database access: read `docs/guides/persistence-architecture.md`; extend the owning repository port
  and Prisma adapter, bind them in the Nest module and test the service with a fake port.
- Service/write/status/money: `services-persistence.md` (explicit mapping, Decimal, tx propagation,
  concurrency evidence and schema/backfill impact).
- List/report/export: `queries.md` (base scope, capabilities, count, stable compound sort, volume).
- Error/event/audit/side effect: `events-errors.md` (keys, safe snapshots, commit ordering and delivery).
- Verification: `testing-completion.md`; select the relevant behavioral boundaries.

These files live under `docs/guides/backend-rules/`. `vendure-source-map.md` provides the pinned
source symbols and two traced request flows when a pattern's origin or adaptation is in question.
Do not assume GraphQL inputs, TypeORM transactions or Permission.Owner work identically in DebtFlow.

## Testing requests

When asked to add, check or reorganize tests, read [the testing workflow](references/testing.md).
It selects the owning `_test/` folder, behavioral scenarios and authorized test environment; the
project testing guide remains the canonical verification contract.

## Establish the change

1. Inspect the working tree. Identify the API behavior requested, the owning feature and the smallest
   change that satisfies it; preserve unrelated work. A question or review-only request is not permission
   to refactor, write database data, commit or deploy.
2. Read the affected controller, DTO, service, role policy, list-query definition and Prisma model as
   needed. Trace relevant callers and the response contract. Prefer an existing implementation in the
   same feature before adding an abstraction or dependency.
3. For tenant/identity/money changes, identify who is authorized, which tenant owns every supplied ID,
   what state transitions are allowed, and the transaction boundary before editing.

## Implement and verify

- Put changes with their owner. Keep controller bindings/policy/docs, DTO validation and service
  orchestration distinct. Extract a named helper for a distinct responsibility when useful.
- Preserve the API envelope, EN/VI keys and shared query parser. An auth failure must be corrected at
  the real boundary; removing guards, tenant conditions or validation is not a fix.
- Add regression coverage for a concrete failing scenario. When authorization is affected, include
  an unauthorized role or foreign-tenant ID; for transaction work, cover the failing operation as well
  as success. Do not manufacture database records just to smoke-test a request without authorization.
- Run the checks selected by `AGENTS.md`, including the conventions gate for changed handlers and
  `npm run check:maintainability` for structure/type/helper changes. Existing response/query debt is
  frozen to exact legacy handlers; changing one requires fixing its relevant
  violations and removing stale entries. Never add a baseline exemption to evade a required rule.
  Regenerate API/database references when their source changes.
- Review the final diff for scope, exposed sensitive fields, generated noise and unexpected files.
  Report behavior, validation and material limitations. Do not claim that static checks prove security.

For a new endpoint, check that its owning Nest module registers the controller/service and that its
role and response decorators match the actual HTTP behavior. For schema work, include the intended
migration but do not apply it to an unspecified database.

Follow `.ai/core/workflow/verification.md#keep-verification-proportional`: select affected checks, reuse passing results, and obtain explicit approval before full-suite or deep verification.
