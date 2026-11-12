# Repository automation

Run the npm commands in the [root command reference](../README.md#command-reference) from the
repository root. Script paths are implementation details; npm names are the member-facing entrypoints.

| Owner | Files and responsibility | Entrypoints |
| --- | --- | --- |
| `ai/` | Offline rule/skill installation and portability tests. Sources remain in `.ai/`. | `ai:setup`, `ai:check`, `test:ai` |
| `quality/` | Architecture, conventions and reuse checkers; reviewed route policies and baselines. | `check:architecture`, `check:conventions`, `check:maintainability`, `test:architecture` |
| `database/` | Explicit staging/production migration commands and project-specific Party demo import. | `db:deploy:staging`, `db:deploy:production`, `db:status:staging`, `db:status:production`, `import:parties`, `test:database-tools` |
| `prisma/` | Schema-to-TypeScript list-query metadata and Swagger response-model generators. | `db:generate`, `test:response-models` |
| `docs/` | OpenAPI and Markdown generation using the compiled application. | `docs:api` (build first) |
| `build/` | Compiled import rewriting and standalone/Vercel runtime smoke tests. | `build`, `test:runtime` (build first) |

Tests for tooling stay beside their subject as `*.test.mjs`; application specs belong in
`src/<owner>/_test/`. Do not create another folder per one-line npm command.
Unrelated local CV scripts are ignored legacy files, not maintained tooling; do not copy or commit them.

## File format

`.mjs` tools run directly as Node ES modules without compiling the application or adding a loader.
This remains explicit when copied into a project with another package `type`. `.ts` tools are kept
when they consume application TypeScript types (API docs and Party import), and use the existing `tsx`.
Do not convert all scripts to TypeScript or add another runner solely for matching extensions.

## Reuse in another project

- **AI installer:** copy `.ai/core/` and `scripts/ai/ai-setup.mjs` at matching paths; follow the
  [team setup guide](../docs/team/ai-setup.md#copy-to-another-nestjs-project).
- **Migration launcher:** copy `database/database-migrate.mjs` and its tests. It needs Node 24,
  installed Prisma, and that project's Prisma config. It resolves Prisma's published CLI entry
  from the target project's package metadata. Exported `migrationCommand()` accepts `cwd`/`env`
  for another project root or fixtures and never executes a command itself.
  The CLI accepts only staging/production and deploy/status. Each environment file must supply
  both DATABASE_URL and DIRECT_URL; these override inherited URLs. Adapt names deliberately
  for a project with a different environment/configuration contract.
- **Prisma generators:** schema-driven, but output imports and scalar mappings target this project's
  generated-client layout and Nest Swagger. Adapt those paths/contracts before reusing.
- **Quality gates, build hook and docs/import tools:** project-specific. They encode feature layout,
  policy, TypeScript output directories or compiled Nest configuration; copying them alone does not
  establish equivalent architecture or data safety in another project.

## Changing tooling

Reuse the existing owner. Keep project paths relative, avoid credentials/hard-coded machine paths,
and keep imports side-effect free for exported testable tools. Commands that write data remain explicit;
build/generation/check commands must not incidentally migrate or seed a database.
When moving a script, update package.json, Prisma generators, Nest hooks, Docker COPY paths, tests,
rule sources and docs together. Run only affected tooling tests/checks; real DB writes and broad
runtime matrices require separate authorization. Add no old-path forwarding wrappers.

## TypeScript coverage

`npm run typecheck` includes `scripts/**/*.ts` together with application/spec/seed types.
Backend build configs explicitly exclude tooling so scripts do not enter deploy artifacts.
Party demo import requires `npm run import:parties -- <organizationId> [count]`; it checks the
organization is active, uses the tenant-scoped unique code, and updates normalized search text.
It writes directly to the configured DB; use it only for authorized development/demo fixtures.
