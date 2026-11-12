# Service, persistence and transaction rules

Vendure's services own database orchestration, use scoped repositories/context and compose named
helpers; its transaction wrapper shares the transaction manager through context (V12–V16,
V19–V20). DebtFlow uses the installed Prisma 7 client and `PrismaService`, not TypeORM or a copied
Vendure `RequestContext`/`TransactionalConnection` subsystem.

## DB-01 — explicit service inputs and data mapping

Service methods MUST communicate the use case and accept the required trusted tenant/actor context.
Preserve established signature order when extending an existing method. New methods MUST NOT use
Express request/response objects or optional hard-coded organization fallbacks. Request DTOs are
acceptable as typed use-case input in this codebase; a separate command layer is warranted only for
a real independent caller/transport, not automatic boilerplate.

Map accepted fields explicitly; do not pass a request object directly to Prisma `data`, `where`,
`include` or `orderBy`. Database-managed IDs, tenant, creator, audit actor, paid amount and status
transitions must not become editable merely because a generic `Partial<Model>` includes them.
Respect omission/null behavior and recalculate derived values from merged state. `parties/party.mapper.ts`
and `toMemberDto` are specific useful examples; not every Prisma field is a safe public field.

## DB-02 — separate shape validation and business invariants

Services MUST check allowed state transitions, related ownership, cross-field dates, uniqueness
conflicts and monetary limits. Share a pure named rule helper when multiple operations need the same
decision. Controllers are not the only callers a service may ever have; document which invariants are
guaranteed by the public boundary and which the service enforces itself. Do not put asynchronous
tenant authorization into a generic formatting/normalization decorator.

Use meaningful error helpers and codes. A preflight uniqueness lookup may improve feedback but does
not replace the actual database unique constraint and central conflict handling. Do not catch an
unknown database failure and return success or mislabel an outage as invalid credentials.

## DB-03 — one atomic use case uses one transaction client

When a payment changes voucher, allocations and debt balances, or another operation spans dependent
writes, the whole invariant MUST commit or roll back together. Application services use the repository
port; only its infrastructure implementation creates the Prisma transaction. The pattern is:

```ts
const payment = await this.repository.inTransaction(async (store) => {
  const debt = await store.findDebt(organizationId, debtId);
  const amount = paymentAmount(input.amount);
  assertPayableDebt(debt, amount);
  return this.createVoucher(store, {
    organizationId,
    allocations: [{ amount, debt }],
    input: { ...input, createdById },
    partyId: debt.partyId,
    type: debt.type,
  });
});
this.auditCreated(payment, organizationId, createdById);
return payment;
```

`payments/payment-allocation.rules.ts` owns amount checks and the pure allocation algorithm;
`debts/rules/debt-payment.rules.ts` owns balance-to-status calculation reused through Debts' public
contract by payment application and reversal. Keep those rules independent of HTTP, Prisma clients
and event emission. `payments/queries/payments.query.ts` owns authorized list composition. Services
retain the use-case boundary through the transaction-scoped store and publish audit only after successful completion. Allocation priority
is due date, issue date, creation time, then unique debt ID; the ID resolves otherwise equal priorities.
The adapter binds every store operation to the same `tx`. Do not expose `TransactionClient` to
application services or replace the scoped store with global mutable transaction state.

This demonstrates transaction-client propagation and event ordering, **not** a complete concurrent
payment algorithm. Inside adapter callbacks and all called persistence helpers, use the same `tx`, not the root client
by accident. Application callbacks receive a typed use-case store, never a Prisma delegate. A helper that starts a separate root
transaction is not part of the caller's transaction. Keep network calls, file uploads, email and long
computations out of a database transaction. A single-row atomic write need not acquire a transaction
solely to match a template.

## DB-04 — atomicity is not race safety

For read-check-write balances, unique sequential codes, suspending/demoting owners or state changes,
identify concurrent requests that can invalidate the check. Choose the smallest appropriate protection:
a database uniqueness/check constraint, conditional update with an expected state/version and checked
affected-row count, lock, or supported transaction isolation with bounded retries for retryable conflicts.
Do not retry business validation errors indiscriminately or claim `Promise.all` inside one transaction
makes its statements run in parallel. Authorization decisions about mutable roles must not use stale
global caches; Vendure RoleService deliberately rereads roles before granting writes.

Money MUST stay in Decimal arithmetic, including comparisons, sums, allocation and reversal; converting
to JS `number` for decisions can lose precision. Validate schema precision/scale, positive/nonnegative
rules as applicable, remaining balances and currency consistency. Returned money follows the string
contract. Date-only business decisions use the existing Vietnam business-date utilities and explicit
calendar validation; do not depend on the server OS timezone.

## DB-05 — schema and migration belong to the change

Keep models/enums with their owning Prisma domain file. Schema constraints and indexes must match the
intended ownership/access pattern; a nullable unique value and a soft-deleted record require explicit
duplicate/reuse semantics. Add a new intentional migration, review backfill/default/index/extension
requirements, run `db:check` and regenerate the client/reference. Never edit an applied migration or
hand-edit generated client code. Validation/build is not proof the migration succeeds on real data.
Do not apply migrations, seed, import, reset or delete real data as an incidental test.

**Acceptance:** name the invariant and transaction boundary, show `tx` propagation, cover rollback,
and use an authorized disposable database for real constraint/concurrency claims. Source-only mocks
must be described as such. Use the APIs of the installed Prisma major version; newer online docs may
describe a different client API.


## DB-06 — repository contracts and Prisma adapters

Follow [Persistence architecture](../../development/persistence-architecture.md). Every feature that accesses the
DB owns `repositories/<feature>.repository.ts` (abstract DI contract) and
`infrastructure/prisma-<feature>.repository.ts` (implementation). Nest modules bind the two with
`provide`/`useClass`; application services and listeners inject only the contract. Do not construct
an adapter in application code or re-export implementation classes through `public/`.

Contracts expose named operations and use-case data, not Prisma delegates, arbitrary `where`/`data`
arguments or `TransactionClient`. Reuse existing DTOs, domain rules and named projection types;
do not invent generic CRUD repositories or duplicate all generated models. Generated enums, Decimal
values and typed projections remain deliberate compile-time/value dependencies; this is not a claim
of complete ORM-independent Domain Driven Design.

Read adapters own filters, SQL, aggregation and snapshot pagination. Write services own business
validation, state rules, tenant/actor context and post-commit audit; adapters own persistence mapping
and the actual transaction. Related party/member/product lookups needed for a write occur through
its transaction-scoped store, not through another root-client service call. Ordinary standalone
membership checks still use Users' exported service.
