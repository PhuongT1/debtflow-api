# DebtFlow API — Agent Guide

This is the canonical instruction entry point for this **NestJS REST API**. Read this file first;
read only the topic guides needed for the task. Explicit user instructions define the authorized scope.

## Shared NestJS core and team setup

Read [.ai/core/index.md](.ai/core/index.md), then its applicable topic files, before implementation.
That portable core owns general NestJS structure, naming, validation, provider, transaction and testing
rules. This guide and `docs/guides/backend-rules/` specialize them for DebtFlow's REST/Prisma contract.
Project configuration lives in [.ai/project.json](.ai/project.json); do not move DebtFlow assumptions
into the reusable core. Run `npm run ai:setup` after cloning or updating rule/skill sources, and
`npm run ai:check` to verify the local installation. See [team setup](docs/guides/ai-setup.md).

## Scope and repository hygiene

- Confirm the working directory and inspect `git status --short` before editing. Preserve existing
  user changes and keep unrelated work out of the diff and commits.
- Work in this API repository. Sibling repositories, including Vendure, are references unless the
  user asks to change them. Their package managers, stacks and instruction files are not API policy.
- Use npm and `package-lock.json`. Do not introduce another lockfile, package layout, framework or
  dependency without a concrete requirement in the task.
- Put business code in the owning domain under `src/modules/<feature>/`; access policy belongs to
  routes, not public/protected folder trees. Search for existing helpers and callers before adding files.
- Put genuinely shared infrastructure in `src/common/`; it must not import feature or auth code.
  `src/config/` and `src/database/` also must not depend on features or auth. Controllers delegate
  persistence to services rather than importing the database layer or constructing a Prisma client.
- Put reusable repository automation in `scripts/`. Put one-off experiments, screenshots, exports
  and unrelated document/CV scripts outside the repository, normally in the OS temporary directory
  or the user's explicitly requested destination. Do not move or delete existing unrelated files
  without authorization.
- Do not hand-edit `src/generated/prisma/`, `dist/` or `docs/generated/`. Change their source and
  regenerate. Keep browser artifacts and VitePress build/cache/temp output ignored.

## Security and business invariants

- Protected business operations get `organizationId`, actor identity and role from the authenticated
  context. Never trust body/query roles or tenant IDs as authorization. Login and organization
  switching may request a tenant, but must verify active membership before issuing tokens.
- Scope reads, counts, aggregates, exports, writes and related IDs to the authorized tenant. An
  existing ID is not proof that a user can access it. Do not introduce hard-coded tenant fallbacks.
- Preserve active user/membership/organization checks and current-role enforcement. Mutations need
  an explicit role policy and service-level ownership/status rules. Do not widen public access to
  make a request or a test pass.
- Public handlers and self-service member mutations without a role gate need exact reviewed entries
  with reasons in `scripts/backend-route-policy.json`. No directory grants an auth/policy exception.
- Validate request DTOs; keep unknown-field rejection, the response envelope and EN/VI error keys.
  Use the per-resource list-query allow-list; never expose arbitrary Prisma columns or raw queries.
- Use `Prisma.Decimal` for money. Changes to payments, allocations and debt balances must remain
  atomic and preserve status rules. Publish audit events after successful changes/transaction commit;
  include the actor and tenant, and exclude credentials, tokens and password hashes from snapshots.
- Do not print secrets, real tokens, connection strings or bulk private data. Use placeholders or
  sanitized fixtures. Do not commit real `.env` files or credentials; sanitized `.env.example` and
  `.env.production.example` are templates.
- Do not run seed/import/reset scripts or apply a migration to a database as an incidental check.
  Use static validation first; database writes require authorization for that environment.

## Required implementation contract

For provider, DTO, type, query or structure changes, read
[Maintainability and reuse](docs/guides/backend-rules/maintainability.md) and its portable core topic.
Cross-feature imports use named `public/` contracts and owning Nest modules, never private implementation
folders or HTTP calls back to this application. Search existing owners/callers before defining another
contract/helper. Run `npm run check:maintainability`;
do not bypass it with duplicated types, renamed clones or a new exemption.

Before creating/changing backend code, read the [Backend Rules index](docs/guides/backend-rules/index.md)
and its required topic sections. It defines file/class/DTO names, Nest provider ownership, route/status/
response contracts, runtime validation/null semantics, tenant/related-ID checks, transaction/event order
and the required verification. MUST rules apply to new/changed code; neighboring legacy code is not a waiver.
The [pinned Vendure source map](docs/guides/backend-rules/vendure-source-map.md) shows the actual resolver,
service, transaction, event and test evidence and the REST/Prisma adaptations. Do not invent claims about it.

## Read by responsibility

| Task | Read when relevant |
| --- | --- |
| Implement a backend change | [Backend Rules](docs/guides/backend-rules/index.md), required topics, then the owned implementation |
| Auth, tenants, permissions | [Authorization](docs/guides/authorization.md) and [Business Rules](docs/03-business-rules.md) |
| Sort/filter/pagination | [List Query](docs/guides/list-query.md) and the resource's `*.list-query.ts` |
| Prisma schema or migration | [Database Workflow](docs/guides/database-workflow.md) and the affected models/migrations |
| Audit events | [Audit Log](docs/guides/audit-log.md) and existing emit/listener code |
| Response or validation | [API Response Format](docs/guides/api-response-format.md) and [Localization](docs/guides/localization.md) |
| Architecture or new file placement | [Project Structure](docs/guides/project-structure.md) and [Vendure Reference](docs/guides/vendure-reference.md) |

## Verification and completion

- Run `npm run check:architecture` and `npm run check:conventions` for backend structure/contract changes,
  and `npm run lint` for TypeScript. The conventions baseline contains only reviewed pre-existing response/
  query debt, locked per handler fingerprint. A changed/new handler must comply; remove stale entries.
  Do not broaden exemptions or put security/naming violations in that baseline to make checks pass.
- Run meaningful targeted tests for changed behavior, especially tenant isolation, permissions,
  money, status transitions and failure paths. Extend existing suites when they own the scenario.
- Run `npm run build` for backend changes; add `npm run db:check` for Prisma changes. These commands
  validate/generate/compile; they do not prove a migration is safe against a real database.
- For API/schema changes, regenerate references with `npm run docs:generate`; run `npm run docs:build`
  for documentation-site changes. Generated changes belong with the source change.
- `npm run check` combines architecture checks, checker tests, lint, unit tests and build. Choose
  checks proportional to the task; avoid reinstalling dependencies or rerunning passed checks without cause.
- Report changed behavior, actual check results and remaining limitations. Instructions and import
  checks do not replace authorization tests, code review or database constraints.

## Project skills and Git

Read [.codex/skills/SKILLS.md](.codex/skills/SKILLS.md) when asked about project skills.
Portable skill defaults live in `.ai/core/skills/`. DebtFlow-specific skill sources live in
`.codex/skills/` and replace same-named defaults as configured in `.ai/project.json`.
`ai:setup` installs local copies into `.agents/skills/`, `.claude/skills/` and `.cursor/skills/`.
Edit the versioned sources, never the ignored installations. Do not create discovery symlinks.

- `$backend-change` / `/backend-change`: implement or fix a NestJS backend feature using the project workflow.
- `$review` / `/review`: read-only code review; do not edit, commit or push during a review request.
- `$commit` / `/commit`: prepare or create clean commits; commit only when explicitly requested.

Slash-style names are project text aliases, not guaranteed UI slash commands. Use review before
commit when requested. Never push, amend/rewrite history, revert user changes, or run destructive Git
operations unless explicitly authorized. Prepare the concrete result before requesting any required approval.
