# ADR 0004: Audit log through domain events

- Status: accepted
- Date: 2026-10-30

## Context

The `AuditLog` table and `GET /audit-logs` existed, but no code wrote any entry, and the endpoint was
readable only by `ADMIN`, a role nobody has in the seed data. Services should not know how audit is
stored, and an audit failure should not break a debt or payment.

## Decision

- Services publish an `audit.recorded` event (`emitAudit`) after a change succeeds. `@nestjs/event-emitter` is the bus, the same decoupling Vendure gets from its event bus.
- `AuditLogsListener` (in the audit-logs module) is the only writer of `AuditLog`.
- Entries carry organization, actor, entity, action and `before`/`after` snapshots of the record's own columns.
- `OWNER` and `ADMIN` may read the log, scoped to their organization.

## Consequences

- A new audited action costs one `emitAudit` call plus an entry in `AuditAction`.
- Mutating service methods now receive the actor id from the controller.
- Delivery is in-process and best effort. The trade-off is accepted for now; switch to writing inside the business transaction if a guaranteed trail becomes a requirement.
- Because no history exists before this change, older records have no entries.
