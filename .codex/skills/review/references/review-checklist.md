# Review Checklist

Use this checklist only when relevant to the changed files. For implementation contracts, consult
`docs/guides/backend-rules/index.md` and its matching sections. Do not apply an unrelated rule set.

## Naming, Wiring And API Contract

- File/class/DTO names and owner follow the documented role-specific convention.
- A provider has one owning Nest module; consumers import exports rather than redeclaring instances.
- Whole-object body/query uses an actual runtime DTO class, not a type-only import, interface or Record.
- Request validation proves shape/type/null/blank/nested bounds; decorators are not business authorization.
- Every handler documents the actual response shape/status and has deliberate auth classification.
- POST action runtime status and envelope metadata agree; binary/204 exceptions are explicit.
- New/changed handlers pass `check:conventions`; no security/naming exceptions or broadened legacy waivers.


## NestJS API

- Controllers should keep routing, guards, request binding, and Swagger docs.
- Services should contain business logic and data access orchestration.
- DTOs should define request shape, validation decorators, and field docs.
- Global pipes and filters should preserve a stable API error shape.
- Guards must protect endpoints that depend on authenticated identity.
- Avoid leaking internal errors, password hashes, tokens, or DB details.

## Validation And Error Shape

- Unknown fields should be handled intentionally through `whitelist` and `forbidNonWhitelisted`.
- Field-level errors should be easy for FE to map: `field`, `message`, `code`.
- Top-level error messages should be stable and not require FE to parse text.
- Machine-readable codes should be constants when reused.

## Prisma

- Schema changes must have matching migrations.
- Never edit migrations already shared or applied by other environments.
- Multi-file schema should keep models/enums near their owning domain.
- Shared enums should move to a domain file only when they truly have multiple owners.
- Running `npm run db:check` should validate schema and generate the client.
- Generated Prisma client imports should still resolve to `src/generated/prisma`.
- Seed changes should be idempotent.

## Data And Money

- Validate amounts, dates, currency, statuses, and ownership.
- Check decimal handling for money.
- Check state transitions such as debt paid/cancelled/partial.
- Avoid destructive updates without explicit intent.

## Tenant And Authorization Boundaries

- Trace controller identity into every affected read/count/aggregate/write/export. The client cannot
  authorize an organization, role or actor merely by supplying it in the request.
- Check related resource IDs and assignees against the current tenant and required active states.
- Preserve active membership/user/organization lookup and current-role checks, including tokens issued
  before a suspension or role change.
- Query filter OR groups must remain inside the service tenant scope; per-resource allow-lists must
  exclude sensitive/internal fields.
- Check concrete forbidden-role and foreign-tenant scenarios where the change affects authorization.
- For money/state changes, inspect transaction and concurrency boundaries; audit events follow commit.
- Infrastructure must not import feature/auth code. Controllers delegate persistence to services.
  `npm run check:architecture` detects literal import violations, not arbitrary runtime data access.

## Security

- Passwords must be hashed and never returned.
- Auth errors should not reveal whether an email exists.
- JWT secret and database URLs must not be committed.
- CORS and token handling should match FE usage.

## Verification

- For Prisma changes: `npm run db:check`.
- For backend changes: `npm run build`.
- For risky logic: targeted tests or a clear manual verification path.
