# Persistence architecture

DebtFlow keeps its feature modules and adds an explicit application-to-persistence boundary.
Single ordinary responsibility files stay at the feature root; group them when there are at least
two. DTO/test/public/repository/infrastructure boundaries remain separate even for one file.
This decision applies to Auth, Users, Parties, Debts, Payments, Catalog, Dashboard, Reports and
Audit Logs. Exports already consumes Debts' public service. Imports remains a documented scaffold;
add its own contract/adapter when implementing database operations, not empty folders now.

For a concrete module walkthrough and current limitations, see
[Party implementation example](../getting-started/party-architecture.md).

## Feature layout and dependency direction

```text
modules/payments/
  payments.module.ts                         # DI composition
  payments.controller.ts         # HTTP, validation, authorization
  payments.service.ts               # use-case and business decisions
  repositories/payments.repository.ts        # abstract port and scoped write-store contract
  infrastructure/prisma-payments.repository.ts
  queries/                                  # owned projections/filter configuration
  payment-allocation.rules.ts                # single allocation/amount rule file
  payment.types.ts                           # single named result/value file
  public/                                   # intentional cross-feature API
  _test/                                    # service/adapter/rule tests
```

The request flows Controller → Service → Repository contract. The Prisma adapter implements that
contract and is bound by the owning module through Nest `provide`/`useClass`. Application services
and listeners never import `PrismaService`, PrismaClient or a concrete adapter. Controllers keep
existing routes/status/envelopes. Cross-feature consumers still use public contracts and Nest modules.

A repository exposes operations such as `findDebt`, `findDebts`, `createPayment` or `isActive`, not
`prisma.debt`, a generic CRUD interface, `WhereInput` or arbitrary SQL. SQL, query composition,
projections and snapshot pagination belong to the owning read adapter/helpers. Existing typed
projections, generated enums and Decimal values are reused rather than mirrored as new models.
Those remaining type/value dependencies mean this is not a completely ORM-independent domain model.

## Transactions and business decisions

Payments, Debts and Parties expose `inTransaction(work)`. The Prisma implementation creates one interactive
transaction and constructs a plain, transaction-scoped store whose methods close over the same `tx`.
The application callback checks business invariants and composes those operations. No root Prisma
client or `TransactionClient` crosses this port. There is no global mutable transaction context.

Payment voucher, allocations and debt balance updates use one store. Debt creation checks active
party/member/product access using its store; line-item validation is independent of database access.
Debt cancellation checks allocations and updates status in one transaction. The shared
`database/serializable-transaction.ts` uses Serializable isolation and retries P2034 conflicts at
most twice after the initial attempt. Business errors and unrelated DB failures are not retried.
Callbacks must therefore be replay-safe: audit, files, network calls and other external effects
remain outside the transaction. A live concurrency guarantee needs real database verification;
mock tests establish orchestration/retry behavior only. Sequential debt codes retain their existing
unique constraint; an unhandled unique conflict is not silently retried as a business success.

Party updates read the scalar snapshot, derive searchText and write through one serializable store;
conflict retries recompute from the new snapshot. Party deactivation checks unsettled debts and writes
in that same boundary. Debt creation also uses Serializable: both writers must retain it so concurrent
creation/deactivation retries and rechecks the business rule. Audit stays after commit. Native PostgreSQL
opt-in tests cover both commit orders and concurrent PATCH; they do not cover arbitrary SQL/import writers.
Party detail scopes both the parent and debt relation to the tenant.

Parties read-model pagination keeps RepeatableRead and computed sorts in the database. Reports
retain full-filtered-set aggregates. Dashboard/Catalog read adapters own projections; do not invent
write-domain entities just to wrap a read query. Audit persistence remains best effort as documented.

## References and adaptation

- `nest-boilerplate/src/modules/tasks/repositories/task.repository.ts`,
  `infrastructure/prisma-task.repository.ts` and `tasks.module.ts` in the user's local reference
  demonstrate the abstract port, adapter and DI binding. Its contracts still import Prisma types;
  do not claim this pattern alone removes every ORM dependency.
- Vendure's `packages/core/src/service/services/customer.service.ts` uses
  `TransactionalConnection.getRepository(ctx, ...)`; its resolver uses `@Transaction()`. Learn
  transaction propagation and explicit ownership, rather than copying TypeORM machinery into Prisma.
- [Nest custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [Prisma v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- [Vendure service layer](https://docs.vendure.io/current/framework/developer-guide/the-service-layer)

## Enforcement and verification

`check:architecture` rejects application-to-database/implementation imports, generated-client
construction outside adapters and direct generated imports in repository ports. `check:maintainability`
checks repository placement and existing public feature boundaries. Keep enums/value types separate
from client ownership; these checks do not prove that monetary or tenant behavior is correct.

Use fake ports for application decisions, adapter tests for scoped queries/transaction wiring and
focused Nest composition tests for DI. Preserve existing applicable regression suites. Follow the
proportional verification policy: broad/full-suite or live database checks need explicit approval.
