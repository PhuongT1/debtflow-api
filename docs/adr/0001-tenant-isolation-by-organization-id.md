# ADR 0001: Tenant isolation by `organizationId`

- Status: accepted (documents a decision already implemented in migration `20260904140000_add_organizations_and_tenant_isolation`)
- Date: 2026-09-04

## Context

DebtFlow serves several businesses (and personal workspaces) from one database. Data of one organization
must never be visible to another.

## Decision

Every business table carries a mandatory `organizationId`. The organization comes **only** from the
verified JWT (`organizationId` + `membershipId` + `role`), never from request bodies or query strings.
Controllers pass `user.organizationId` to services; services include it in every `where` clause.
Uniqueness is per tenant (`@@unique([organizationId, code])`).

## Consequences

- Simple and portable: one schema, no per-tenant databases, works with Neon pooling and serverless.
- Isolation depends on discipline: a query that forgets `organizationId` leaks data. Review every new query for it,
  and add the column to every new business table.
- No database-level enforcement (no PostgreSQL row-level security). Revisit RLS if the number of tenants or
  the sensitivity grows.
- A role change reaches an already-issued access token only after it expires or is refreshed.

## Notes

`GET /audit-logs` initially missed the `organizationId` filter and was corrected on 2026-10-30. The generic list query ([List Query](../guides/list-query.md)) cannot filter or sort on `organizationId` because it is never in a resource's allow-list.
