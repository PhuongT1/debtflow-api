# Identity, access and resource boundaries

- MUST derive the actor and privileged context from authenticated server state. Body/query roles,
  tenant IDs or user IDs are input, never authority. Public session selection must verify access
  before issuing a session. Preserve active-account and current-permission checks.
- Every route needs an explicit public/protected classification using the project's mechanism.
  Mutations need deliberate permissions/roles plus service-level ownership and status rules.
  A guard's presence does not prove its policy is correct. Empty role lists may be unrestricted.
- Identify the actual ownership boundary: organization, account, channel, workspace or another
  resource model. Scope reads/counts/aggregates/exports and writes consistently where applicable.
  Do not invent tenancy for single-tenant systems or copy a hard-coded fallback tenant.
- Keep trusted base conditions outside client-controlled OR/filter groups; authorization must apply
  before pagination/counting. Validate every related ID against its required owner and active state.
- Check actual write preconditions. A successful earlier lookup does not prevent concurrent access
  changes; use the project's transactional or conditional-write strategy when the invariant needs it.
- Output DTOs are not security filters. Select allowed account fields. Exclude credentials, password
  hashes, tokens and unrelated private relations from responses, logs and event/audit snapshots.
- Never weaken auth, CORS, validation or database permissions just to make a request/test pass.
  Parameterize SQL, allow-list query capabilities and assess dynamic identifiers explicitly.
- Use sanitized fixtures. Do not print secrets, real environment files, connection strings or bulk
  private records. Read variable names/templates or presence checks when diagnosing configuration.

For changed access behavior, include forbidden-role and foreign-owner/tenant cases as applicable,
inactive identity cases and a failure path that performs no unauthorized write or success event.
