# Database Workflow

Prisma schema is the source of truth. This project uses multi-file Prisma schema.

## Folder Structure

```txt
prisma/
  schema.prisma
  models/
    user.prisma
    party.prisma
    debt.prisma
    payment.prisma
    audit-log.prisma
  migrations/
  seed.ts
```

`prisma/schema.prisma` contains only `generator` and `datasource`.

Domain models and enums live under `prisma/models/`.

Prisma config is in:

```txt
prisma.config.ts
```

The config points Prisma CLI to the folder:

```ts
schema: 'prisma/';
```

## Add A Field Or Table

1. Edit a file in `prisma/models/`.
2. Create and apply a migration:

```bash
npm run db:migrate -- --name add_party_website
npm run db:generate
```

3. Commit these files:

```txt
prisma/models/*.prisma
prisma/migrations/<timestamp>_<migration_name>/migration.sql
```

4. Do not commit:

```txt
src/generated/prisma
dist
.env
```

## After Pulling Teammate Changes

```bash
npm install
npm run db:migrate
npm run db:generate
```

This applies pending migrations and regenerates Prisma Client.

## Before Pushing Prisma Changes

```bash
npm run db:check
npm run build
```

## Production Deploy

Vercel only builds the application artifact:

```bash
npm run build
```

Apply committed migrations as an explicit release step before promoting the deployment:

```text
npm run db:deploy
npm run build
```

Configure `DATABASE_URL` and `DIRECT_URL` in the Vercel Production environment before deploying.
Preview deployments never run production migrations. This avoids concurrent builds or preview
deployments changing the production schema.

## Rules

- Do not edit migrations that were already pushed or applied by other environments.
- Every schema change should have a matching migration.
- Keep enums near the domain that owns them.
- Move an enum to a new domain file only when multiple domains truly share it.

## Useful Commands

| Command               | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `npm run db:migrate`  | Create and apply development migrations.                      |
| `npm run db:generate` | Generate Prisma Client and TypeScript types.                  |
| `npm run db:deploy`   | Apply committed production migrations.                        |
| `npm run db:validate` | Validate all Prisma schema files.                             |
| `npm run db:check`    | Validate schema and generate client.                          |
| `npm run db:studio`   | Inspect database in Prisma Studio.                            |
| `npm run db:seed`     | Seed default admin user.                                      |
| `npm run build:prod`  | Build the production artifact without migrating the database. |
