# ADR 0002: Documentation as code with generated reference

- Status: accepted
- Date: 2026-10-30

## Context

Hand-written API tables and database diagrams went stale: the previous role matrix lacked `OWNER` and
multi-tenancy, and the structure guide missed the catalog module.

## Decision

- **Reference is generated**, never typed by hand:
  - API reference from the OpenAPI document (`@nestjs/swagger` CLI plugin + `@ApiTags`/`@ApiOperation`
    - the `x-roles` extension emitted by `@Roles`) -> `docs/generated/openapi.json`, `api-reference.md`.
  - ERD and column dictionary from the Prisma schema with `prisma-markdown` (Mermaid) -> `docs/generated/database.md`.
- **Explanation is hand-written** and kept short: overview, architecture (C4 + Mermaid), business rules, ADRs.
- Generated files are committed so they are reviewable in pull requests and render on GitHub.
- `npm run docs:check` regenerates everything and fails if `docs/generated` differs from what is committed.

## Consequences

- Adding an endpoint requires `@ApiOperation` (and DTO decorators) or it appears with an empty summary.
- Adding a Prisma model or column requires a `///` comment or the dictionary entry is blank.
- `docs:generate` builds the project, so it needs the same environment as `npm run build` (a `.env` with `DATABASE_URL`/`DIRECT_URL` for Prisma config; any valid-looking values work, no connection is opened).
