# Authentication and Authorization

The API uses two independent global guards:

1. `JwtAuthGuard` verifies the access token, checks the current active membership, user and organization,
   and writes the authenticated identity and current database role to `request.user`.
2. `RolesGuard` reads `@Roles(...)` metadata and enforces the endpoint's role policy.

`@PublicApi()` is reserved for routes such as login and health checks. A protected controller should
use `@ProtectedApi()` and declare a narrower role policy only for operations that mutate sensitive
data.

## Role matrix

Roles are organization roles (`OWNER`, `ADMIN`, `ACCOUNTANT`, `VIEWER`) read from the current membership. The
check is an exact match against the roles listed in `@Roles(...)`, not a hierarchy. The current matrix is
maintained in [Business Rules](../03-business-rules.md#roles-and-permissions); the per-endpoint roles are
generated in [API Reference](../generated/api-reference.md).

Controllers declare policy; services enforce business invariants. Never rely on hiding buttons in
the frontend as authorization.

## Adding a protected endpoint

```ts
@Post()
@Roles(OrganizationRole.ADMIN, OrganizationRole.ACCOUNTANT)
create(@Body() input: CreateExampleDto) {
  return this.service.create(input);
}
```

Add `@ApiOperation` so the endpoint is documented, and use a DTO with `class-validator` for every external request body. Do not accept
`Record<string, unknown>` and cast values into Prisma enums: that bypasses runtime validation.

## Changes to access

Each protected request reads the membership matching all three token identifiers: membership id,
user id and organization id. Suspended memberships, inactive accounts and inactive organizations are
rejected with 401 even when the token has not expired. Role changes apply on the next request because
`RolesGuard` receives the current database role. Requests already executing are not cancelled.

This adds one database lookup per protected request. Refresh also validates the current user and
membership before issuing new tokens.
