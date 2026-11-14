# DebtFlow API

NestJS backend API for Debt Flow / Sales Debt Management: multi-tenant tracking of receivables and
payables, payments with automatic allocation, collection follow-up, dashboard, aging report and Excel export.
Start with the [documentation](./docs/README.md). Use Node 24 (`nvm use`) and npm;
[Run Source](./docs/getting-started/running/index.md) covers local development.
[Deployment](./docs/deployment/index.md) covers CI/CD, staging, production, Vercel and Docker.

AI coding agents start at [AGENTS.md](./AGENTS.md). Backend contribution rules and verification are in
[AI Backend Development](./docs/team/ai-development.md). Run `npm run check` for the local quality checks.

## AI setup for every member

After cloning or pulling updated rules/skills, run:

```bash
npm run ai:setup
npm run ai:check
```

This installs shared rules/skills for Codex, Claude Code and Cursor, plus Copilot instructions.
It runs offline without database access. Restart the AI session after setup.
The reusable NestJS core lives in [.ai/core](.ai/core/index.md); DebtFlow rules specialize it.
See [AI setup](./docs/team/ai-setup.md) and [reuse in another project](./docs/team/ai-setup/reuse-in-project.md).

## Important: After Changing A Prisma Model

Whenever you add, remove, rename, or change a field in `prisma/models/*.prisma`, follow this
workflow before continuing NestJS development:

```text
Edit a Prisma model
        ↓
npm run db:migrate:dev -- --name describe_your_change
        ↓
npm run db:generate
        ↓
npm run dev
        ↓
Commit the model and generated migration
```

Example after adding `phone` to `prisma/models/user.prisma`:

```bash
npm run db:migrate:dev -- --name add_phone_to_user
npm run db:generate
npm run dev
```

The migration command updates the development database. The generate command updates Prisma
Client and its TypeScript types. Commit both:

```text
prisma/models/<changed-model>.prisma
prisma/migrations/<timestamp>_<migration-name>/migration.sql
```

## Run Backend

First setup:

```bash
npm install
cp .env.example .env
npm run setup:dev
```

For production configuration, use `.env.example` as the variable checklist. A real
`.env.production` is ignored by Git. On Vercel, add the values in **Project Settings >
Environment Variables** instead of uploading or committing an environment file.

When running the compiled application outside Vercel with `NODE_ENV=production`, Nest loads
`.env.production` first and falls back to `.env` for missing values.

Database migrations are intentionally separate from the Vercel build. Before promoting a release
that contains a new Prisma migration, run `npm run db:migrate:apply` once against the production database,
then deploy the API. Preview builds must never migrate the production database.

Daily development:

```bash
npm run dev
```

`npm run setup:dev` performs the initial migration, generates Prisma Client, seeds the admin plus
idempotent payment demo data, and starts NestJS. After setup, `npm run dev` starts NestJS in watch
mode.

## Important Links

Use the Swagger URL printed at startup. `<PORT>` below is the value from `.env`; the default is 4000:

```txt
API base URL:  http://localhost:<PORT>/api
Swagger UI:    http://localhost:<PORT>/docs
OpenAPI JSON:  http://localhost:<PORT>/docs-json
```

DebtFlow Shell server-side API env:

```env
API_BASE_URL=http://localhost:<PORT>/api
```

The browser calls the shell's same-origin BFF. Do not expose the backend URL with a
`NEXT_PUBLIC_*` variable.

## Default Login

Created by `npm run db:seed:demo`:

```txt
Email:    admin@debtflow.local
Password: Admin@123456
Role:     ADMIN
```

## Command reference

Run commands from the repository root. Use `npm run` to list available scripts.
The groups below follow the order in `package.json`; script names and behavior are shared across environments.
For staging/production connection files and migration steps, follow the [database guide](./docs/database/index.md).

### Run and build

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API in watch mode. |
| `npm run debug` | Start watch mode with the Node debugger. |
| `npm run setup:dev` | Migrate and seed the development DB, generate clients, then start the API. |
| `npm run start` | Run the compiled API; build first. |
| `npm run build` | Generate Prisma client/metadata, compile, and rewrite build aliases. |

### Database

| Command | Purpose |
| --- | --- |
| `npm run db:migrate:dev` | Create and apply development migrations; accepts -- --name <name>. |
| `npm run db:migrate:apply` | Apply committed migrations to the configured target DB. |
| `npm run db:migrate:apply:staging` | Apply pending migrations using database URLs from .env.staging. |
| `npm run db:migrate:apply:production` | Apply pending migrations using database URLs from .env.production. |
| `npm run db:migrate:status:staging` | Check migration history using .env.staging; does not apply SQL. |
| `npm run db:migrate:status:production` | Check migration history using .env.production; does not apply SQL. |
| `npm run db:generate` | Generate Prisma client, list-query metadata, and response models. |
| `npm run db:validate` | Validate the Prisma schema without applying migrations. |
| `npm run db:check` | Validate the schema and regenerate clients/metadata. |
| `npm run db:studio` | Open Prisma Studio for the configured DB. |
| `npm run db:seed:demo` | Write development/demo fixtures; do not use as production setup. |
| `npm run db:user:create:dev` | Interactive user creation using .env; resolve/create the default workspace. |
| `npm run db:user:create:staging` | Interactive user creation using .env.staging; organization ID is optional. |
| `npm run db:user:create:production` | Explicitly provision one scoped user using .env.production when authorized. |
| `npm run db:import:parties -- <organizationId> [count]` | Write demo Parties to an explicit active organization; default 100, maximum 1000. |

### Code checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check TypeScript, including specs, without emitting output. |
| `npm run lint` | Check source code with ESLint. |
| `npm run format` | Rewrite formatting with Prettier across the repository. |
| `npm run format:check` | Check formatting without rewriting files. |
| `npm run check:architecture` | Check architectural dependency boundaries. |
| `npm run check:conventions` | Check backend route, DTO, and response conventions. |
| `npm run check:maintainability` | Check reuse, naming, and feature boundaries. |
| `npm run check` | Run the full project verification pipeline; use targeted checks for daily changes. |

### Tests

| Command | Purpose |
| --- | --- |
| `npm test` | Run the default Vitest suites; use npm test -- <spec-path> for a targeted file. |
| `npm run test:watch` | Run Vitest in watch mode; accepts a spec path. |
| `npm run test:docs` | Verify shared documentation copy behavior without starting the API. |
| `npm run test:quality` | Test architecture, conventions, and maintainability checkers. |
| `npm run test:database-tools` | Test migration launcher env selection using fixtures; no DB connection. |
| `npm run test:response-models` | Test the response-model generator. |
| `npm run test:runtime` | Smoke-test compiled standalone and Vercel entries; build first. |
| `npm run test:parties:postgres` | Run optional Party balance tests on an explicitly configured disposable PostgreSQL DB. |
| `npm run test:ai` | Test AI setup, portability, conflicts, and Git ignore behavior. |

### Documentation

| Command | Purpose |
| --- | --- |
| `npm run docs:dev` | Start the documentation site; open the URL printed by VitePress. |
| `npm run docs:build` | Build the static documentation site. |
| `npm run docs:preview` | Preview the built documentation site locally. |
| `npm run docs:generate:api` | Generate OpenAPI JSON and the API reference; build first. |
| `npm run docs:generate:database` | Generate the database reference from Prisma models. |
| `npm run docs:generate` | Build the API and regenerate both API and database references. |
| `npm run docs:check` | Regenerate references and fail if docs/generated has uncommitted changes. |

### Team AI setup

| Command | Purpose |
| --- | --- |
| `npm run ai:setup` | Generate local AI rules and skills from .ai sources. |
| `npm run ai:check` | Verify the generated AI installation without writing files. |

## Changing Prisma Models

Prisma models are stored in `prisma/models/`. Whenever you add, remove, or change a field,
create a new migration and regenerate Prisma Client.

For example, after adding this field to `prisma/models/party.prisma`:

```prisma
model Party {
  // Existing fields...
  website String?
}
```

Run:

```bash
npm run db:migrate:dev -- --name add_party_website
npm run db:generate
```

The first command creates a new SQL migration and applies it to the development database. The
second command updates the generated TypeScript client and types.

Then start or restart the API:

```bash
npm run dev
```

Use a short migration name that describes the change, for example:

```bash
npm run db:migrate:dev -- --name add_party_address
npm run db:migrate:dev -- --name make_party_email_unique
npm run db:migrate:dev -- --name add_debt_reminder_date
```

Do not edit a migration that has already been applied. Change the Prisma model and create another
migration instead. Commit both the changed `.prisma` file and the generated migration directory.

For staging or production, apply committed migrations with:

```bash
npm run db:migrate:apply
```

`db:migrate:apply` does not create a migration and does not regenerate Prisma Client. The `build` command
generates Prisma Client before compiling the application.

## Documentation

Full documentation lives in [docs/](./docs/README.md):

- [Product Overview](./docs/reference/overview.md) - what DebtFlow does, features, glossary
- [Architecture](./docs/getting-started/architecture.md) - system context, modules, auth, tenancy, frontend integration
- [Business Rules](./docs/reference/business-rules.md) - roles, debt lifecycle, payment allocation
- [Database](./docs/database/overview.md) and [generated ERD](./docs/generated/database.md)
- [API Reference](./docs/generated/api-reference.md) (generated from OpenAPI)
- Guides: [Run Source](./docs/getting-started/running/index.md), [API And Swagger](./docs/development/http/api-and-swagger.md),
  [API Response Format](./docs/guides/api-response-format.md), [List Query](./docs/development/persistence/list-query.md),
  [Localization](./docs/development/localization.md), [Audit Log](./docs/development/audit-log.md), [Vendure Reference](./docs/adr/vendure-reference.md), [Request Flow](./docs/getting-started/architecture/request-flow.md),
  [Database Workflow](./docs/database/index.md), [Project Structure](./docs/development/source/project-structure.md),
  [Authentication And Authorization](./docs/development/authorization.md),
  [Validation And Errors](./docs/development/http/validation-and-errors.md), [Import Aliases](./docs/development/source/import-aliases.md)
- [Project AI Skills](.ai/skills/SKILLS.md)

After changing an endpoint, DTO or Prisma model, run `npm run docs:generate` and commit
`docs/generated/`. `npm run docs:check` fails if the committed files are out of date.

## Tech Stack

- Node 24 native ESM / TypeScript 6
- NestJS 12
- Prisma 7
- PostgreSQL / Neon
- JWT auth
- Swagger / OpenAPI


Endpoint discovery: [Endpoint catalog](./docs/generated/endpoints.md) lists every HTTP method and URL from the compiled OpenAPI document.
Path definitions live in `src/common/constants/api-routes.constants.ts`; controllers use `API_ROUTES`
for `@Controller(...)` and named method paths. HTTP verbs, policy and implementations remain in
the owning controllers. Run `npm run docs:generate` after a route change; do not edit the catalog.

### Shared runtime configuration

`src/config/app.config.ts` owns the typed `server`, `database` and `auth` configuration.
Nest loads it after environment files; providers import `appConfig` and `AppConfig`, then inject
`@Inject(appConfig.KEY)` instead of reading environment variables themselves.
Add shared settings and defaults there, validation in `src/config/env.validation.ts`, and concise
English comments (at most two lines per variable) in the env templates.
Prisma CLI, seed and import reuse `readDatabaseConfig()` without requiring JWT configuration.
`DIRECT_URL` is optional and falls back to `DATABASE_URL`; set it when schema tooling needs a direct
endpoint while the application uses a pooled one. Both URLs must target the same database.

### Ready-made test accounts

Run `npm run db:user:seed:dev` or `npm run db:user:seed:staging` to create six stable
QA accounts without entering credentials. Existing compatible accounts are preserved.
See [accounts and roles](docs/database/users/create-user.md); production uses individual provisioning.
