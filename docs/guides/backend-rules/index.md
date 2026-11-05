# Backend implementation rules

These are the DebtFlow-specific rules layered over the portable NestJS core in `.ai/core/`.
Keep ORM, tenant, envelope, business and command choices here; keep general NestJS rules in the core.
Member installation and copying the core to another project are documented in [AI setup](../ai-setup.md).

This is the normative implementation contract for new or changed DebtFlow API code. **MUST** means a
required project rule; **SHOULD** means the default unless the task has a concrete reason to differ.
The root `AGENTS.md` selects this contract; tool-specific adapters and skills must not redefine it.
An explicit user instruction can authorize a different outcome, but the agent must identify the
affected contract and preserve the actual security boundary. Routine implementation decisions do not
require another approval.

These rules follow a source review of Vendure commit
`3ef5fbe70e59ddfd70b4753e9c164ec7934d03eb`, not an assumption that every existing Vendure or DebtFlow
file is a perfect template. Read the [source map](./vendure-source-map.md) for the examined symbols,
what they establish, and what changes when adapting GraphQL/TypeORM to REST/Prisma 7.

## Select by change

| Change                                     | Required sections                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| New feature or feature file                | [Ownership and naming](./ownership-naming.md)                                                         |
| Providers, DTOs, types, queries, refactors | [Maintainability and reuse](./maintainability.md)                                                     |
| Add/change a route                         | [HTTP contract](./http-contract.md), [validation](./validation.md), [security](./security-tenancy.md) |
| Service, database, status or amount        | [Services and persistence](./services-persistence.md), security                                       |
| List/filter/export                         | [Queries](./queries.md), validation, security                                                         |
| Event/audit/error/side effect              | [Events and errors](./events-errors.md), persistence                                                  |
| Verification of changed behavior           | [Testing and completion](./testing-completion.md)                                                     |

Read the applicable rules and real neighboring implementation before editing. A new CRUD endpoint
usually crosses all these boundaries; a message-only fix does not. Start with the current contract,
not an invented generic repository/service framework or an unregistered sample module.

Persistence and transaction boundaries are defined in
[Persistence architecture](../persistence-architecture.md) and DB-06 in services/persistence.

## What automation enforces

`npm run check:architecture` checks import layering. `npm run check:conventions` checks AST-level
file/class naming, auth classification, role metadata on protected business mutations, request DTO
classes, concrete response DTO classes, operation/response documentation, statically determinable response status mismatches and
unsafe raw-query calls. Decorator aliases/namespaces are resolved; an unrelated function named
`Roles` does not satisfy the policy check.

`npm run check:maintainability` enforces responsibility folders and selected type/helper reuse
boundaries. Its scope and limits are described in [Maintainability and reuse](./maintainability.md).

Features are owned by domain under `src/modules/<feature>/`. The architecture gate rejects the old
auth-first folder roots. Reviewed public handlers and self-service member mutations are listed exactly
in `scripts/backend-route-policy.json`; moving a file into an auth folder cannot waive a role gate.
Missing/stale policy entries fail the conventions gate and cannot enter the legacy baseline.

The conventions checker records existing **response documentation** and **untyped query** debt in
`scripts/backend-conventions-baseline.json`. Every entry identifies one handler, one rule and its
exact significant-token fingerprint, including class decorators. It does not waive a whole file:
changing that handler invalidates the waiver; fix the relevant debt and remove stale entries. New
handlers have no waiver. Security/naming rules cannot be put in this baseline. Expanding the baseline
needs a separately reviewed, explicitly justified change; it is not how an agent makes CI pass.

This is a gradual adoption mechanism, not a declaration that legacy handlers comply. Run
`npm run check:conventions -- --report-legacy` to see the actual remaining items. It intentionally
does not retrofit unrelated in-progress work or change API behavior while introducing rules.

TypeScript can check declarations; it cannot prove correct roles, DTO business constraints, tenant
scoping, output confidentiality, monetary arithmetic, transaction isolation or race safety. Those
requirements remain mandatory in review and applicable behavioral/database tests. GitHub must have
the `API quality` check configured as required if maintainers want it to block merges; the workflow
file alone does not configure branch protection.

## Existing examples are evidence, not blanket permission

- Current JSON handlers have typed response decorators; the conventions baseline is empty.
  Binary export queries use `QueryDebtsDto` and explicitly document their binary response.
- Business service tenants must be explicit. Do not add hard-coded defaults or optional unscoped filters;
  debt/payment/party/report boundaries reject missing tenant context before querying.
- Existing Party PATCH treats null required fields as a no-op; new APIs must define null semantics
  explicitly rather than assuming `PartialType` rejects null.
- Account/member rules and payment transactions do not by themselves prove race safety. Do not claim
  that two concurrent writes are safe because unit tests of a pure guard pass.
- The audit listener is best-effort in-process. Party aggregate sorting runs in PostgreSQL and
  hydrates one page; it still needs matching-debt aggregation and does not establish unlimited scale.

The code must satisfy the requested behavior, these rules and the actual response/schema contract.
When they conflict, investigate the concrete case and report it instead of silently weakening a rule.
