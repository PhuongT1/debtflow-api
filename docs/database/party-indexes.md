# Party indexes and disposable database tests

The schema already declares a per-organization unique code, organization/name and
organization/searchText B-tree indexes, plus type/active/assignee/province indexes. Their presence in
source does not prove they have been applied in a particular environment.

Migration `20261102100000_optimize_party_list_indexes` adds:

- Party `(organizationId, isActive, name, id)` for the default tenant/active list order.
- Debt `(organizationId, partyId, status, type)` for tenant-scoped per-party aggregation.
- Party `searchText` GIN `gin_trgm_ops` for contains searches, with `pg_trgm` enabled explicitly.

Existing indexes remain; evaluate overlap from actual workload/plans before removing them. A plain
B-tree is not a suitable acceleration for the existing `%term%` search. Short/common terms can still
cause scans. Aggregate balance sorting must compute matching debt totals; these indexes do not
store or pre-sort balances. The migration uses ordinary CREATE INDEX, so schedule deployment for
table size/write-lock impact. The deployment role must be allowed to enable `pg_trgm`, or a DBA must
enable it first. Static schema validation does not establish production deployment safety.

Run the opt-in SQL suite only against an explicitly authorized disposable PostgreSQL database:

```bash
PARTY_QUERY_TEST_DATABASE_URL='<dedicated-test-database-url>' npm run test:parties:postgres
```

There is deliberately no fallback to `DATABASE_URL`. The suite creates a random schema, minimal
synthetic tables/fixtures and the new indexes inside one transaction, then rolls it back. It needs
schema/extension privileges. Default `npm test` skips this suite when the dedicated variable is absent.
It covers tenant isolation, every existing filter family, single-field/null/enum ordering, zero balances,
large Decimal amounts, pre-pagination ranking and a 10,000-Party/100,000-debt workload returning one
page. This is query/migration-DDL evidence on synthetic data, not a full migration-history, Prisma
transport, multi-connection concurrency or production latency test. The current verification also
ran it through an isolated PGlite PostgreSQL engine installed outside the repository; PGlite is not
a project dependency. Repeat against the deployment's native PostgreSQL before setting latency goals.

`db:generate` regenerates both the ESM client (`src/generated/prisma/`) and the minimal list-query
schema metadata (`src/generated/list-query/`). Both are ignored source artifacts compiled into
`dist/`; do not edit them. The metadata generator receives Prisma schema data during generation
and does not connect to a database.
