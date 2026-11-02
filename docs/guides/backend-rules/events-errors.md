# Events, auditing, errors and side effects

Vendure emits typed entity events and distinguishes normal commit-aware subscribers from blocking
handlers in the transaction. Its errors carry machine codes, i18n keys and variables (V26–V27,
V21). DebtFlow has a smaller REST envelope and best-effort audit listener; preserve that actual contract.

## EVT-01 — publish only a successful business outcome

For audited operations use the shared `AuditAction`, `emitAudit` and `AuditLogsListener`. The service
provides trusted organization/actor/entity identity and the appropriate before/after shape; the listener
owns writing `AuditLog`. Publish after the relevant mutation or `$transaction` resolves successfully.
Do not publish inside a transaction callback that can still roll back: `EventEmitter2` does not wait
for commit like Vendure's `ofType(...).awaitActiveTransactions` path.

Snapshots MUST include only intended safe state, convert Dates/Decimals consistently and exclude
password hashes, tokens, secret-bearing objects and unrelated loaded relations. Account snapshots
use explicit allowed fields; calling `scalarSnapshot` on a full User is not a credential filter.
For structured details such as payment allocations, construct the safe nested shape explicitly.

Audit storage failure is currently logged without failing the already-successful business operation.
Test that actual contract. Do not call this durable/exactly-once recording. When a task requires
reliable audit/external delivery, design a transactional outbox or another real delivery mechanism
with retry/idempotency requirements, rather than adding more `emit` calls.

## EVT-02 — lifecycle and external effects have owners

Listeners, queue handlers and external integrations need an owning module/provider and controlled
lifecycle. Do not subscribe once per request or instantiate extra clients in controllers. Long-running
external work must have failure, timeout, cancellation/retry and duplicate-delivery behavior appropriate
to the use case. Keep it out of request/database critical sections unless the contract requires it.
Vendure blocking handlers can deliberately affect a transaction; do not claim that all Vendure events
are after-commit/nonblocking or reproduce that behavior accidentally in this API.

## ERR-01 — one error contract across transports

Use the existing `badRequest`, `forbidden`, `notFound`/other app error helpers with stable translation
keys and parameter values. Add matching EN/VI entries and keep stable machine codes. The global
exception filter maps these to the response envelope; do not create per-controller catch-all formatters
or return HTTP 200 with a failure object instead of throwing the appropriate application error.

Shape failures are 400 with field details, invalid/missing authentication is 401, forbidden authenticated
operations are 403, scoped missing resources are 404, and unique conflicts are 409 under the established
project mappings. Map the concrete business case; do not expose another tenant's resource existence or
raw database stacks/SQL. Never swallow a database outage as success, an empty valid report or bad password.

Vendure sometimes returns GraphQL `ErrorResultUnion` values for expected domain outcomes. That is
evidence of typed business errors, not permission to copy GraphQL unions into this REST envelope.
Keep typed internal outcomes if needed, then map them deliberately at the established boundary.

**Acceptance:** successful write emits the correct tenant/actor and safe snapshot, failed write/rollback
does not emit success, listener failure follows the documented best-effort behavior, new keys translate
in both locales, and runtime status/envelope/code/field details match the documented outcome.
