# Authorization, tenant and resource scope

Vendure applies `@Allow` at resolvers and still uses channel-aware resource lookups, ownership checks
and current permissions when granting access (V01–V03, V07–V08, V12–V13, V22). A Vendure channel can
share entities across channels; it is **not** an identical data model to DebtFlow's organization-owned
rows. `Permission.Owner` in Vendure is also **not** DebtFlow's `OrganizationRole.OWNER`.

## SEC-01 — authentication is not authorization

- Protected routes MUST use the current authenticated context. Preserve the JWT guard's check of
  active user, membership and organization, with matching subject/membership/organization IDs.
- Business mutations MUST declare an explicit `@Roles` policy at controller or handler level. A list
  of roles is an exact allow-list, not an inheritance hierarchy; `PLATFORM_OWNER` is not automatically
  an organization OWNER. Match the real business matrix and test a forbidden role.
  The policy must be nonempty: `@Roles()` (including an empty method-level override) is not a
  restriction because the current RolesGuard treats an empty list as unrestricted.
- Credential login/refresh and authenticated organization switching are special session operations
  under the auth API owner. Switching still verifies membership in the requested organization;
  do not add an administrator-only gate to a legitimate self-service operation just to satisfy a rule.
- Services/rules MUST preserve operation-specific restrictions: changing one's own access, granting
  OWNER, touching another OWNER, editing a global shared account, or modifying terminal records.
- Never widen `@PublicApi`, remove a guard, manufacture an actor, or trust a body/query `role`,
  `actorId` or `organizationId` to make a request succeed. Public placement is not permission to
  implement unguarded tenant mutations. Domain folders do not authorize public access. New anonymous
  handlers need an exact reviewed `publicHandlers` entry in `scripts/backend-route-policy.json`, with
  a reason and the actual endpoint verification (for example a webhook signature check). Self-service
  authenticated mutations without an administrator role need an exact `memberMutations` entry.
  The checker rejects unlisted public routes and stale entries; these are policy, not legacy waivers.

## SEC-02 — scope the base query before client filters and pagination

For every affected detail/list/count/aggregate/export/update/delete, identify the owning organization.
The service base condition MUST include the trusted tenant. Client filters are ANDed with it:

```ts
const baseWhere: Prisma.PartyWhereInput = { organizationId, isActive: true };
const { where, orderBy } = applyListQuery<
  Prisma.PartyWhereInput,
  Prisma.PartyOrderByWithRelationInput[]
>(listQuery, { where: baseWhere, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
```

Do not spread client conditions after trusted scope (`{ organizationId, ...input }`), put the tenant
inside only one OR branch, or filter unauthorized rows after `skip/take` and `count`. Vendure
`RoleService.findAll` computes visible IDs before pagination; the same ordering principle applies here.
Counts, pagination metadata, balance calculations, pickers and exports can leak tenant data even when
the visible primary row looks safe. New service methods MUST require tenant context; never add a
`'org_legacy_debtflow'` default or use a missing organization as a global-search fallback.

## SEC-03 — related IDs and writes remain scoped

MUST verify a supplied party/debt/payment/category/member/assignee belongs to the active organization
and has the required active status before using it. A global `User` can belong to multiple tenants;
assignee lookup needs the **organization membership and global user state**, not just `user.findUnique`.
For protected resource access prefer a scoped lookup and the project's not-found outcome rather than
revealing that an ID exists in another organization.

For writes after a scoped read, keep the write's tenant/state preconditions explicit where Prisma
supports them, and keep dependent checks/writes in the same required transaction. A preceding read
alone does not protect a concurrent status/ownership change. If another use case can race it, choose
a database constraint, conditional write, lock or isolation/retry design and test that failure path.
Do not replace missing DB/authorization evidence with a TypeScript non-null assertion.

## SEC-04 — outputs, logs and external effects

Select only intended account fields; global user records, authentication methods, password hashes,
reset/refresh/access tokens and real secrets MUST NOT leak through ordinary outputs, audit snapshots,
logs, fixtures, generated references or external research. A DTO annotation is not a serializer filter.
Audit actor/tenant fields are server-owned. Demo Swagger token controls are a documentation-client
feature, not permission to log credentials or store refresh tokens in shared browser persistence.

Parameterize any necessary raw SQL. `$queryRawUnsafe` and `$executeRawUnsafe` are rejected by the
conventions check. A tagged SQL API still requires review of dynamic identifiers and tenant scope.
Do not change CORS, auth, secret configuration, public route scope or database privileges to bypass a
failure; diagnose the real contract first.

**Acceptance:** show the identity → policy → tenant/resource → write path; include the relevant
foreign-tenant ID, forbidden-role and inactive/stale-token cases. For shared accounts verify another
organization is unaffected. No static rule proves these dataflow/security properties.
