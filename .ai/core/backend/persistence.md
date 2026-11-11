# Services, queries, transactions and effects

- MUST use the project's installed persistence layer and client lifecycle. The core does not choose
  an ORM. Use explicit use-case inputs/results and field mapping; avoid mass assignment.
- Services enforce business transitions, ownership, cross-field limits and monetary invariants.
  A uniqueness preflight is not a database constraint. Map known conflicts without hiding outages.
- Dependent writes that maintain one invariant MUST commit or roll back together. Propagate the same
  transaction client/context to every helper. A helper using the root client or starting an independent
  transaction escapes that boundary. Keep slow network/file work outside transaction critical sections.
- Atomicity does not prove race safety. For read-check-write operations identify conflicting requests
  and use appropriate constraints, expected-state/version updates, locking or isolation with bounded
  retries. Check affected-row counts. Do not retry business validation failures indiscriminately.
- Keep money in the project's decimal/money type for sums and decisions. Define rounding, scale,
  currency and string serialization. Avoid JavaScript floating-point conversions for balances.
- Use one maintained list-query parser and per-resource field/operator allow-list. Count and rows
  share the authorized condition. Pagination needs a stable unique tie-breaker. Computed sorting
  applies before slicing and must preserve compound keys; assess full-scan/in-memory costs.
- Load only required relations and avoid N+1 queries. Reports/exports must declare whether they cover
  all data or a capped window. Do not describe a single ordinary page as a complete export.
- Publish success events only after the corresponding commit, unless the project deliberately uses
  a transaction-aware event mechanism. Plain emitters do not wait for database commit.
  Carry trusted actor/scope and safe snapshots. Document best-effort delivery honestly; use an outbox
  only when durable delivery is required. External retries need timeout/idempotency behavior.
- Keep schema constraints, indexes, migrations and backfills consistent with the change. Never edit
  an applied/shared migration or hand-edit generated clients. Static validation does not establish
  migration safety against existing data. Do not migrate/seed/reset a database as an incidental check.

Verify rollback/no-success-event behavior, transaction propagation and relevant scope/status cases.
Real isolation/constraint/concurrency claims require an authorized disposable database test.


When the project chooses repository ports, put abstract contracts and concrete persistence adapters
in the project's documented folders. Services depend on the port; module composition binds its
implementation. A port exposes use-case operations, not a renamed ORM client or arbitrary query
arguments. Keep dependent writes in one transaction through a scoped store; never give every
repository an unrelated transaction. Preserve typed results without cloning every database model.
