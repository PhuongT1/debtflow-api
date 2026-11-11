# Verification and completion

Vendure's customer/channel suites test invalid business input and cross-channel operations;
pure patch helpers have focused specs for undefined/null/ID behavior (V22–V25). Use those behavioral
boundaries, with this repository's test runner, fixtures and ownership.

## TST-01 — test the changed decision at the right boundary

| Changed responsibility            | Minimum relevant evidence                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Pure mapping/access/status helper | direct scenarios including omitted/null/zero and invalid transition where relevant                     |
| DTO/transform/global validation   | real DTO instance and shared pipe for whitelist/transform; wrong type, limits, nested/unknown fields   |
| Controller HTTP contract          | status, body/envelope, real DTO binding, policy metadata and error serialization                       |
| Service tenant/related-ID checks  | valid case plus foreign tenant/forbidden/inactive case, with no write/audit on rejection               |
| Query/sort/pagination             | equal values, secondary keys, nulls, page boundaries, matching count and scope                         |
| Transaction                       | rollback on failure and no success event; verify all persistence calls share the transaction client    |
| Constraint/concurrency guarantee  | authorized disposable real database test; a mock cannot establish locking/isolation/unique enforcement |
| Audit/listener                    | correct action/tenant/actor/safe fields; failed business write versus failed audit storage             |
| Export/report                     | full declared volume, beyond one page/cap, correct content type and tenant filter                      |
| New checker/tool                  | a real violating fixture fails, a valid fixture passes, and a plausible bypass/regression is covered   |

Extend an existing suite when it owns the scenario; put specs in the owning `_test/` folder. Use deterministic dates,
explicit timezone, Decimal values and sanitized identities. Reset timers/mocks and clean up only the
test-owned temporary resources. Do not seed, reset, migrate or create records in an unspecified DB to
claim a test passed. Do not run the full Vendure test infrastructure just to validate DebtFlow rules.

Mocks are useful for orchestration/failure boundaries, not proof of Prisma query acceptance, rollback,
database constraints or concurrency. HTTP tests with mocked Prisma verify the HTTP integration only;
state that limitation. Prefer an in-process app or a dedicated temporary port rather than stopping an
unrelated existing development server/browser session.

## TST-02 — select and run the actual checks

Follow `.ai/core/workflow/verification.md` (repository source, section "Keep verification proportional").
The commands below are a menu, not a per-request checklist. Default to affected specs/cases, for
example `npx vitest run src/modules/parties/_test/party.mapper.spec.ts` (add `-t` for a specific case).
Do not run `npm test` or `npm run check` automatically. Full-suite or deep verification requires
explicit approval for the proposed scope; explain the reason and wait before starting. Existing
CI remains unchanged. Reuse passing results for unchanged code, including commit-only work.
Rules-only changes do not require application tests or backend builds.

```bash
npm run check:architecture  # import layering
npm run check:conventions   # naming and declarative API rules + exact legacy ratchet
npm run check:maintainability # responsibility folders, shared contracts and exact helper clones
npm run test:architecture   # executable checker regression tests
npm run lint
npm run typecheck        # full TypeScript project, including test files
npm test
npm run build
```

Vitest executes transpiled tests; it does not establish that TypeScript accepts them. The Nest build
excludes `*.spec.ts`. `npm run typecheck` checks those files with the actual root configuration and
writes no output. DebtFlow uses native ESM on Node 24 with `NodeNext` and short `@...` aliases rewritten during build.
Use explicit `.js` suffixes for application imports (including `/index.js` for barrels),
`import.meta.dirname` for file paths and `import.meta.url` when a module URL is needed.
Tests that require emitted Nest constructor metadata load the compiled graph via
`createRequire(import.meta.url)`; Node 24 supports synchronous ESM interop for this graph.
Build before those tests. Do not suppress editor errors or reintroduce CommonJS output. Use `npm run build` so the required
short-alias rewrite completes before compiled-runtime tests.
See [Import Aliases](../import-aliases.md) and [Run Source](../run-source.md).

`npm run check` combines these and builds first to generate Prisma Client on a fresh checkout. Prisma
schema changes additionally require `npm run db:check`. Changes to API/schema descriptions or response
types require `npm run docs:generate`; documentation-site edits require `npm run docs:build`.
`npm run docs:check` compares generated files to committed state, so pre-existing uncommitted generated
changes are an expected dirty-tree result, not a reason to discard them or edit the generated files.

A failed required check MUST be investigated or explicitly reported with its actual blocking condition.
Do not alter unrelated code, assertions, permissions or the conventions baseline to silence it. Reuse
passed checks unless a new change/failure/uncertainty makes another run useful. Do not install new
frameworks or switch package managers just to run tests already supported by this repo.

## TST-03 — deliver evidence, not a checklist claim

Before reporting completion, inspect the diff and identify:

- the requested behavior and affected owner/route;
- the DTO/null/role/tenant/state/output contracts that changed;
- source and generated references changed together;
- exact checks performed and the scope of mock/manual versus real integration coverage;
- concrete remaining gaps, compatibility changes or migration/data-volume risks.

Do not say an entire module is secure/production-ready because lint, import checks or a happy-path
request pass. Read-only review remains read-only. Implementation does not authorize commit, push,
deployment or database writes beyond the user's request.

`npm run test:runtime` checks native standalone and Vercel entries against a deliberately unreachable
synthetic database URL: Swagger/assets, validation, unauthorized access and shutdown. It does not
replace real database integration tests or a Vercel deployment check. `npm run check` includes it.


## Test placement

All specs and test-only helpers/fixtures in `src` live under an owning `_test/` folder:

```text
src/modules/parties/
  parties.service.ts
  party.mapper.ts
  infrastructure/sql/party-balance-page.sql.ts
  _test/
    parties.service.spec.ts
    party.mapper.spec.ts
    party-balance-page.sql.spec.ts
    party-balance-page.postgres.spec.ts
src/common/query/_test/        # parser tests and test-config.ts
src/auth/_test/                # auth infrastructure
src/config/_test/              # environment validation
src/_test/app.module.spec.ts   # application composition / HTTP
```

Keep tests with their owning feature; create a new spec only when an existing suite does not own
the scenario. Name HTTP and database suites clearly (`*.http.spec.ts`, `*.postgres.spec.ts`).
Use subfolders within `_test/` when the suite grows, not parallel test roots. Repository automation
tests stay with their scripts under `scripts/` and are run by Node's test runner.

Vitest discovers `src/**/_test/**/*.spec.ts`. Typecheck includes these files; the production build
excludes `_test/`. Architecture checks reject misplaced specs and imports from `_test/` into
production. Update relative imports, fixtures, package commands and references together when moving
suites. `npm run test:parties:postgres` stays opt-in and never falls back to the application's DB.

Vendure reference: unit specs are beside subjects (for example
`packages/core/src/service/services/channel.service.spec.ts`), while integration/e2e specs are in
`packages/core/e2e/`. DebtFlow deliberately uses feature-owned `_test/` for all suites to keep
production responsibility folders uncluttered. This is a project convention, not a Nest requirement.
