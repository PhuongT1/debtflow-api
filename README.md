# DebtFlow API

NestJS backend API for Debt Flow / Sales Debt Management: multi-tenant tracking of receivables and
payables, payments with automatic allocation, collection follow-up, dashboard, aging report and Excel export.
Start with the [documentation](docs/README.md).

AI coding agents start at [AGENTS.md](AGENTS.md). Backend contribution rules and verification are in
[AI Backend Development](docs/guides/ai-development.md). Run `npm run check` for the local quality checks.

## AI setup for every member

After cloning or pulling updated rules/skills, run:

```bash
npm run ai:setup
npm run ai:check
```

This installs shared rules/skills for Codex, Claude Code and Cursor, plus Copilot instructions.
It runs offline without database access. Restart the AI session after setup.
The reusable NestJS core lives in [.ai/core](.ai/core/index.md); DebtFlow rules specialize it.
See [team setup and copying to another project](docs/guides/ai-setup.md).

## Important: After Changing A Prisma Model

Whenever you add, remove, rename, or change a field in `prisma/models/*.prisma`, follow this
workflow before continuing NestJS development:

```text
Edit a Prisma model
        ↓
npm run db:migrate -- --name describe_your_change
        ↓
npm run db:generate
        ↓
npm run dev
        ↓
Commit the model and generated migration
```

Example after adding `phone` to `prisma/models/user.prisma`:

```bash
npm run db:migrate -- --name add_phone_to_user
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

For production configuration, use `.env.production.example` as the variable checklist. A real
`.env.production` is ignored by Git. On Vercel, add the values in **Project Settings >
Environment Variables** instead of uploading or committing an environment file.

When running the compiled application outside Vercel with `NODE_ENV=production`, Nest loads
`.env.production` first and falls back to `.env` for missing values.

Database migrations are intentionally separate from the Vercel build. Before promoting a release
that contains a new Prisma migration, run `npm run db:deploy` once against the production database,
then deploy the API. Preview builds must never migrate the production database.

Daily development:

```bash
npm run dev
```

`npm run setup:dev` performs the initial migration, generates Prisma Client, seeds the admin plus
idempotent payment demo data, and starts NestJS. After setup, `npm run dev` starts NestJS in watch
mode.

## Important Links

Open these after the backend starts:

```txt
API base URL:  http://localhost:4000/api
Swagger UI:    http://localhost:4000/docs
OpenAPI JSON:  http://localhost:4000/docs-json
```

DebtFlow Shell server-side API env:

```env
API_BASE_URL=http://localhost:4000/api
```

The browser calls the shell's same-origin BFF. Do not expose the backend URL with a
`NEXT_PUBLIC_*` variable.

## Default Login

Created by `npm run db:seed`:

```txt
Email:    admin@debtflow.local
Password: Admin@123456
Role:     ADMIN
```

## Common Commands

| Command                  | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `npm run dev`            | Start backend in watch mode.                                  |
| `npm run ai:setup`       | Install shared AI rules and skills locally for team clients. |
| `npm run ai:check`       | Verify AI installation without writing files. |
| `npm run test:ai`        | Test setup portability, conflicts and Git ignore behavior. |
| `npm run setup:dev`      | Migrate, generate Prisma Client, seed, and start development. |
| `npm run build`          | Generate Prisma Client and build backend.                     |
| `npm run db:migrate`     | Create and apply migrations in development.                   |
| `npm run db:generate`    | Regenerate Prisma Client from the current models.             |
| `npm run db:deploy`      | Apply committed migrations in staging or production.          |
| `npm run db:validate`    | Validate all Prisma schema files.                             |
| `npm run db:check`       | Validate Prisma models and regenerate Prisma Client.          |
| `npm run db:studio`      | Open Prisma Studio.                                           |
| `npm run db:seed`        | Seed the admin and idempotent payment demo data.              |
| `npm run import:parties` | Import 100 demo customers/suppliers directly into PostgreSQL. |
| `npm test`               | Run unit tests (vitest).                                      |
| `npm run docs:generate`  | Rebuild the OpenAPI JSON, API reference and database ERD.     |
| `npm run docs:dev`       | Open the documentation site locally (http://localhost:5173).  |
| `npm run docs:build`     | Build the static documentation site (`docs/.vitepress/dist`). |
| `npm run docs:check`     | Fail if `docs/generated` is out of date.                      |

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
npm run db:migrate -- --name add_party_website
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
npm run db:migrate -- --name add_party_address
npm run db:migrate -- --name make_party_email_unique
npm run db:migrate -- --name add_debt_reminder_date
```

Do not edit a migration that has already been applied. Change the Prisma model and create another
migration instead. Commit both the changed `.prisma` file and the generated migration directory.

For staging or production, apply committed migrations with:

```bash
npm run db:deploy
```

`db:deploy` does not create a migration and does not regenerate Prisma Client. The `build` command
generates Prisma Client before compiling the application.

## Documentation

Full documentation lives in [docs/](docs/README.md):

- [Product Overview](docs/01-overview.md) - what DebtFlow does, features, glossary
- [Architecture](docs/02-architecture.md) - system context, modules, auth, tenancy, frontend integration
- [Business Rules](docs/03-business-rules.md) - roles, debt lifecycle, payment allocation
- [Database](docs/04-database.md) and [generated ERD](docs/generated/database.md)
- [API Reference](docs/generated/api-reference.md) (generated from OpenAPI)
- Guides: [Run Source](docs/guides/run-source.md), [API And Swagger](docs/guides/api-and-swagger.md),
  [API Response Format](docs/guides/api-response-format.md), [List Query](docs/guides/list-query.md),
  [Localization](docs/guides/localization.md), [Audit Log](docs/guides/audit-log.md), [Vendure Reference](docs/guides/vendure-reference.md), [Request Flow](docs/guides/request-flow.md),
  [Database Workflow](docs/guides/database-workflow.md), [Project Structure](docs/guides/project-structure.md),
  [Authentication And Authorization](docs/guides/authorization.md),
  [Validation And Errors](docs/guides/validation-and-errors.md), [Import Aliases](docs/guides/import-aliases.md)
- [Project Codex Skills](.codex/skills/SKILLS.md)

After changing an endpoint, DTO or Prisma model, run `npm run docs:generate` and commit
`docs/generated/`. `npm run docs:check` fails if the committed files are out of date.

## Tech Stack

- NestJS 11
- Prisma 7
- PostgreSQL / Neon
- JWT auth
- Swagger / OpenAPI
