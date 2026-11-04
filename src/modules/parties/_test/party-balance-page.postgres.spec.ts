import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@generated/prisma/client.js';
import { parseListQuery } from '@common/query/index.js';
import { partyBalancePageSql } from '../queries/party-balance-page.query.js';
import { buildPartyQuery } from '../queries/parties.query.js';
import { PARTY_LIST_QUERY } from '../queries/parties.list-query.js';
import type { QueryPartiesDto } from '../dto/query-parties.dto.js';

// Opt-in only: never fall back to DATABASE_URL. DDL/fixtures live in a fresh schema and roll back.
const connectionString = process.env.PARTY_QUERY_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('Party aggregate ordering on PostgreSQL', () => {
  const client = new Client({ connectionString });
  const schema = `party_query_${randomUUID().replaceAll('-', '')}`;
  let transactionStarted = false;

  beforeAll(async () => {
    await client.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}", public;`);
    // Minimal read-model fixtures: names/types match the production Prisma schema.
    await client.query(`
      CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');
      CREATE TYPE "DebtType" AS ENUM ('RECEIVABLE', 'PAYABLE');
      CREATE TYPE "DebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');
      CREATE TABLE "Party" (
        "id" text PRIMARY KEY, "organizationId" text NOT NULL, "name" text NOT NULL,
        "code" text, "type" "PartyType" NOT NULL DEFAULT 'CUSTOMER', "phone" text, "email" text,
        "taxCode" text, "provinceCode" text, "provinceName" text, "creditLimit" numeric(18,2),
        "isActive" boolean NOT NULL DEFAULT true, "assignedToId" text, "searchText" text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT '2026-11-01', "updatedAt" timestamp NOT NULL DEFAULT '2026-11-01'
      );
      CREATE TABLE "Debt" (
        "id" text PRIMARY KEY, "organizationId" text NOT NULL, "partyId" text NOT NULL,
        "type" "DebtType" NOT NULL, "status" "DebtStatus" NOT NULL,
        "originalAmount" numeric(18,2) NOT NULL, "paidAmount" numeric(18,2) NOT NULL
      );
      INSERT INTO "Party" ("id", "organizationId", "name", "code", "type", "creditLimit", "assignedToId", "searchText", "createdAt", "isActive") VALUES
        ('a','org-a','Alpha','B','CUSTOMER',1000,'u1','alpha b','2026-10-30 17:00:00',true),
        ('b','org-a','Alpha','A','BOTH',null,'u1','alpha a','2026-10-31 16:59:59.999',true),
        ('c','org-a','Beta',null,'CUSTOMER',0,null,'beta','2026-10-31 17:00:00',true),
        ('d','org-a','Gamma','D','CUSTOMER',1000,'u2','gamma d','2026-10-28',true),
        ('e','org-a','Alpha deleted','E','CUSTOMER',1000,null,'alpha deleted','2026-11-01',false),
        ('f','org-a','Supplier','F','SUPPLIER',null,'u2','supplier f','2026-11-01',true),
        ('g','org-a','NoOwnDebt','G','CUSTOMER',null,null,'noowndebt g','2026-11-02',true),
        ('x','org-x','Alpha foreign','X','CUSTOMER',1000,null,'alpha foreign','2026-11-01',true);
      INSERT INTO "Debt" VALUES
        ('a-ar','org-a','a','RECEIVABLE','PARTIAL',120,20),
        ('a-ap','org-a','a','PAYABLE','OPEN',10,0),
        ('a-paid','org-a','a','RECEIVABLE','PAID',100000,100000),
        ('a-cancelled','org-a','a','RECEIVABLE','CANCELLED',999999,0),
        ('b-ar','org-a','b','RECEIVABLE','OPEN',100,0),
        ('b-ap','org-a','b','PAYABLE','OPEN',50,0),
        ('d-ar','org-a','d','RECEIVABLE','PARTIAL',9007199254740993.25,0.05),
        ('e-ar','org-a','e','RECEIVABLE','OPEN',99999,0),
        ('f-ap','org-a','f','PAYABLE','OPEN',100,0),
        ('x-ar','org-x','x','RECEIVABLE','OPEN',999999,0),
        ('cross-a','org-x','a','RECEIVABLE','OPEN',999999,0),
        ('cross-g','org-x','g','RECEIVABLE','OPEN',999999,0);
    `);
    await client.query(
      readFileSync(
        resolve(
          import.meta.dirname,
          '../../../../prisma/migrations/20261102100000_optimize_party_list_indexes/migration.sql',
        ),
        'utf8',
      ),
    );
  }, 30_000);

  afterAll(async () => {
    try {
      if (transactionStarted) await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  });

  async function page(
    raw: Record<string, unknown>,
    query: QueryPartiesDto = {},
    take = 100,
    skip = 0,
  ) {
    const parsed = parseListQuery(raw, PARTY_LIST_QUERY);
    const { where } = buildPartyQuery('org-a', query, parsed);
    const sql = partyBalancePageSql('org-a', where, parsed.sort[0], { take, skip });
    const result = await client.query<{ id: string; receivable: string; payable: string }>(
      sql.text,
      sql.values,
    );
    return result.rows.map(({ id, receivable, payable }) => ({
      id,
      receivable: new Prisma.Decimal(receivable).toString(),
      payable: new Prisma.Decimal(payable).toString(),
    }));
  }

  it.each([
    ['receivable', 'desc', ['d', 'a', 'b', 'c', 'f', 'g']],
    ['name', 'asc', ['a', 'b', 'c', 'd', 'g', 'f']],
    ['receivable', 'asc', ['c', 'f', 'g', 'a', 'b', 'd']],
    ['payable', 'desc', ['f', 'b', 'a', 'c', 'd', 'g']],
    ['outstandingDocuments', 'desc', ['a', 'b', 'd', 'f', 'c', 'g']],
    ['creditLimit', 'asc', ['c', 'a', 'd', 'b', 'f', 'g']],
    ['creditLimit', 'desc', ['b', 'f', 'g', 'a', 'd', 'c']],
    ['code', 'asc', ['b', 'a', 'd', 'f', 'g', 'c']],
    ['code', 'desc', ['c', 'g', 'f', 'd', 'a', 'b']],
    ['type', 'asc', ['a', 'c', 'd', 'g', 'f', 'b']],
  ])(
    'honors single-field ordering, nulls and stable ID tie-breaks for %s %s',
    async (sortBy, sortOrder, expected) => {
      expect((await page({ sortBy, sortOrder })).map(({ id }) => id)).toEqual(expected);
    },
  );

  it('ranks before pagination and retains parties with no own-tenant debt', async () => {
    expect(
      (await page({ sortBy: 'receivable', sortOrder: 'desc' }, {}, 1, 1)).map(({ id }) => id),
    ).toEqual(['a']);
    const rows = await page({ sortBy: 'receivable', sortOrder: 'desc' });
    expect(rows.find(({ id }) => id === 'g')).toEqual({ id: 'g', receivable: '0', payable: '0' });
    expect(rows.find(({ id }) => id === 'a')).toEqual({
      id: 'a',
      receivable: '100',
      payable: '10',
    });
    expect(rows.find(({ id }) => id === 'd')?.receivable).toBe('9007199254740993.2');
  });

  it('uses balanceType as a party filter without removing the opposite-direction balance', async () => {
    const rows = await page(
      { sortBy: 'receivable', sortOrder: 'desc' },
      { balanceType: 'RECEIVABLE' },
    );
    expect(rows.map(({ id }) => id)).toEqual(['d', 'a', 'b']);
    expect(rows.find(({ id }) => id === 'b')?.payable).toBe('50');
  });

  it.each([
    [{ q: 'Álpha' }, ['a', 'b']],
    [{ type: 'BOTH' }, ['b']],
    [{ assignedToId: 'u1' }, ['a', 'b']],
    [{ createdFrom: '2026-10-31', createdTo: '2026-10-31' }, ['a', 'b']],
  ] satisfies Array<[QueryPartiesDto, string[]]>)(
    'preserves named filter semantics: %j',
    async (query, expected) => {
      expect(
        (await page({ sortBy: 'receivable', sortOrder: 'desc' }, query)).map(({ id }) => id),
      ).toEqual(expected);
    },
  );

  it.each([
    [{ 'filter[name][contains]': 'ALPHA' }, ['a', 'b']],
    [{ 'filter[name][notContains]': 'Alpha' }, ['d', 'c', 'f', 'g']],
    [{ 'filter[name][startsWith]': 'Al' }, ['a', 'b']],
    [{ 'filter[name][endsWith]': 'pha' }, ['a', 'b']],
    [{ 'filter[code][isNull]': 'true' }, ['c']],
    [{ 'filter[code][notEq]': 'A' }, ['d', 'a', 'f', 'g']],
    [{ 'filter[code][notIn]': 'A,F' }, ['d', 'a', 'g']],
    [{ 'filter[type][in]': 'BOTH,SUPPLIER' }, ['b', 'f']],
    [{ 'filter[creditLimit][between]': '0,1000' }, ['d', 'a', 'c']],
    [{ 'filter[creditLimit][gt]': '0' }, ['d', 'a']],
    [{ 'filter[creditLimit][gte]': '1000' }, ['d', 'a']],
    [{ 'filter[creditLimit][lt]': '1000' }, ['c']],
    [{ 'filter[creditLimit][lte]': '0' }, ['c']],
    [{ 'filter[creditLimit][notEq]': '0' }, ['d', 'a']],
    [{ 'filter[creditLimit][in]': '0,1000' }, ['d', 'a', 'c']],
    [{ 'filter[creditLimit][notIn]': '0' }, ['d', 'a']],
    [{ 'filter[creditLimit][isNull]': 'true' }, ['b', 'f', 'g']],
    [{ 'filter[createdAt][eq]': '2026-10-31' }, ['a', 'b']],
    [{ 'filter[createdAt][eq]': '2026-10-31T17:00:00.000Z' }, ['c']],
    [{ 'filter[createdAt][after]': '2026-10-31' }, ['c', 'f', 'g']],
    [{ 'filter[createdAt][before]': '2026-10-31' }, ['d']],
    [{ 'filter[createdAt][gte]': '2026-10-31' }, ['a', 'b', 'c', 'f', 'g']],
    [{ 'filter[createdAt][lte]': '2026-10-31' }, ['d', 'a', 'b']],
    [{ 'filter[createdAt][between]': '2026-10-31,2026-11-01' }, ['a', 'b', 'c', 'f']],
    [
      { 'filter[code][eq]': 'F', 'filter[name][contains]': 'Alpha', filterOperator: 'OR' },
      ['a', 'b', 'f'],
    ],
  ])('preserves allow-listed dynamic filter semantics: %j', async (filters, expected) => {
    expect(
      (await page({ ...filters, sortBy: 'receivable', sortOrder: 'desc' })).map(({ id }) => id),
    ).toEqual(expected);
  });

  it('keeps hostile text in parameters and preserves the table', async () => {
    const rows = await page({
      sortBy: 'receivable',
      sortOrder: 'desc',
      'filter[name][contains]': '\' OR TRUE; DROP TABLE "Party"; --',
    });
    expect(rows).toEqual([]);
    expect((await page({ sortBy: 'receivable', sortOrder: 'desc' })).length).toBe(6);
  });

  it('creates the declared indexes in the isolated schema', async () => {
    const result = await client.query<{ indexname: string }>(
      'SELECT indexname FROM pg_indexes WHERE schemaname = $1',
      [schema],
    );
    expect(result.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'Party_organizationId_isActive_name_id_idx',
        'Debt_organizationId_partyId_status_type_idx',
        'Party_searchText_trgm_idx',
      ]),
    );
  });

  it('returns only a page for 10,000 parties and 100,000 debts', async () => {
    await client.query(`
      INSERT INTO "Party" ("id", "organizationId", "name", "searchText")
      SELECT 'bulk-' || lpad(n::text,5,'0'), 'org-bulk', 'Bulk ' || n, 'bulk ' || n
      FROM generate_series(1,10000) AS n;
      INSERT INTO "Debt"
      SELECT 'bulk-debt-' || n, 'org-bulk', 'bulk-' || lpad((((n-1)%10000)+1)::text,5,'0'),
        'RECEIVABLE', 'OPEN', ((n-1)%1000) + 0.25, 0.05
      FROM generate_series(1,100000) AS n;
      ANALYZE "Party"; ANALYZE "Debt";
    `);
    const parsed = parseListQuery({ sortBy: 'receivable', sortOrder: 'desc' }, PARTY_LIST_QUERY);
    const { where } = buildPartyQuery('org-bulk', {}, parsed);
    const sql = partyBalancePageSql('org-bulk', where, parsed.sort[0], { take: 20, skip: 0 });
    const result = await client.query<{ id: string; receivable: string }>(sql.text, sql.values);
    expect(result.rows).toHaveLength(20);
    expect(result.rows[0]).toMatchObject({ id: 'bulk-01000' });
    expect(new Prisma.Decimal(result.rows[0].receivable).toString()).toBe('9992');
    const explained = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql.text}`,
      sql.values,
    );
    const plan = explained.rows[0]['QUERY PLAN'][0];
    console.info(
      'Synthetic PostgreSQL query measurement:',
      JSON.stringify({
        parties: 10000,
        debts: 100000,
        returnedRows: result.rows.length,
        databaseExecutionMs: plan['Execution Time'],
      }),
    );
    const filtered = buildPartyQuery('org-bulk', { q: 'bulk 777' }, parsed);
    const search = partyBalancePageSql('org-bulk', filtered.where, parsed.sort[0], {
      take: 20,
      skip: 0,
    });
    const searchResult = await client.query(search.text, search.values);
    expect(searchResult.rows).toHaveLength(11);
  }, 30_000);
});
