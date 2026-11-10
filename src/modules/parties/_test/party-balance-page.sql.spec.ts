import { describe, expect, it } from 'vitest';
import { DebtStatus, DebtType, PartyType, Prisma } from '@generated/prisma/client.js';
import {
  parseListQuery,
  getAllowedFilterOperators,
  getListQueryFieldNames,
  type FieldType,
} from '@common/query/index.js';
import { partyBalancePageSql } from '../infrastructure/sql/party-balance-page.sql.js';
import { partyWhereSql } from '../infrastructure/sql/party-filter.sql.js';
import { buildPartyQuery } from '../queries/party.query.js';
import { PARTY_LIST_QUERY, PARTY_COMPUTED_SORT_FIELDS } from '../queries/party.list-query.js';

const pagination = { take: 20, skip: 40 };

describe('owned Party SQL boundary', () => {
  it.each([undefined, null, '', ' '])('rejects a missing tenant %s', (organizationId) => {
    expect(() =>
      partyBalancePageSql(
        organizationId as never,
        {},
        { field: 'receivable', direction: 'asc' },
        pagination,
      ),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  it('binds tenant, hostile filter values and page bounds rather than interpolating them', () => {
    const hostile = "'; DROP TABLE Party; --";
    const parsed = parseListQuery(
      { sortBy: 'receivable', sortOrder: 'desc', 'filter[name][contains]': hostile },
      PARTY_LIST_QUERY,
    );
    const { where } = buildPartyQuery('tenant-fixture', {}, parsed);
    const sql = partyBalancePageSql('tenant-fixture', where, parsed.sort[0], pagination);
    expect(sql.text).not.toContain(hostile);
    expect(sql.text).not.toContain('tenant-fixture');
    expect(sql.values).toContain(`%${hostile}%`);
    expect(sql.values).toEqual(expect.arrayContaining([20, 40]));
    expect(sql.text).toMatch(/ORDER BY[\s\S]+p\."id" ASC LIMIT \$\d+ OFFSET \$\d+/);
    expect(sql.text).not.toContain('p.*');
  });

  it.each(getListQueryFieldNames(PARTY_LIST_QUERY, 'sortable'))(
    'has an SQL implementation for declared sort %s',
    (field) => {
      const parsed = parseListQuery({ sortBy: field }, PARTY_LIST_QUERY);
      expect(() =>
        partyBalancePageSql('org-1', { organizationId: 'org-1' }, parsed.sort[0], pagination),
      ).not.toThrow();
    },
  );

  it.each(getListQueryFieldNames(PARTY_LIST_QUERY, 'filterable'))(
    'supports every advertised operator for %s in both Prisma and SQL paths',
    (field) => {
      const definition = PARTY_LIST_QUERY.fields[field];
      const sample: Record<FieldType, string> = {
        string: 'fixture',
        enum: definition.values?.[0] ?? '',
        number: '1',
        decimal: '1.25',
        date: '2026-11-01',
        boolean: 'true',
      };
      for (const operator of getAllowedFilterOperators(definition)) {
        const value =
          operator === 'isNull'
            ? 'true'
            : ['in', 'notIn', 'between'].includes(operator)
              ? `${sample[definition.type]},${sample[definition.type]}`
              : sample[definition.type];
        for (const filterOperator of ['AND', 'OR']) {
          const parsed = parseListQuery(
            { sortBy: 'receivable', filterOperator, [`filter[${field}][${operator}]`]: value },
            PARTY_LIST_QUERY,
          );
          const { where } = buildPartyQuery('org-1', {}, parsed);
          expect(
            () => partyBalancePageSql('org-1', where, parsed.sort[0], pagination),
            `${field}.${operator} (${filterOperator})`,
          ).not.toThrow();
        }
      }
    },
  );

  it('adapts the canonical named filters without rebuilding their business rules', () => {
    const { where } = buildPartyQuery('org-1', {
      type: PartyType.CUSTOMER,
      assignedToId: 'member-1',
      balanceType: DebtType.RECEIVABLE,
      q: 'Shop',
      createdFrom: '2026-11-01',
      createdTo: '2026-11-02',
    });
    const sql = partyBalancePageSql(
      'org-1',
      where,
      { field: 'receivable', direction: 'desc' },
      pagination,
    );
    expect(sql.text).toContain('EXISTS');
    expect(sql.text).toContain('related_debt."organizationId" = p."organizationId"');
    expect(sql.values).toEqual(
      expect.arrayContaining([
        'org-1',
        'member-1',
        PartyType.CUSTOMER,
        DebtType.RECEIVABLE,
        DebtStatus.OPEN,
        DebtStatus.PARTIAL,
        '%shop%',
        '2026-10-31T17:00:00.000Z',
        '2026-11-02T16:59:59.999Z',
      ]),
    );
  });

  it('keeps the legacy document-count alias tied to all tenant debts, not only open balances', () => {
    const sql = partyBalancePageSql(
      'org-1',
      {},
      { field: PARTY_COMPUTED_SORT_FIELDS.outstandingDocuments, direction: 'desc' },
      pagination,
    );
    expect(sql.text).toContain('COUNT(*) AS value');
    expect(sql.text).toContain('COALESCE(sort_totals.value, 0)');
    expect(sql.text.split('page AS')[0]).toMatch(/WHERE d\."organizationId" = \$\d+\s+GROUP BY/);
    expect(sql.text.split('page AS')[0]).not.toContain('SUM(');
    expect(() => parseListQuery({ sortBy: 'outstandingDocument' }, PARTY_LIST_QUERY)).toThrow();
  });

  it.each(['receivable', 'payable'])(
    'aggregates only %s for ranking, then balances only the page',
    (field) => {
      const sql = partyBalancePageSql('org-1', {}, { field, direction: 'desc' }, pagination);
      const ranking = sql.text.split(', page AS')[0];
      expect(ranking.match(/SUM\(/g)).toHaveLength(1);
      expect(ranking).toContain('d."type" =');
      expect(sql.text).toContain('FROM "Debt" d JOIN page selected');
      expect(sql.text).toContain('ORDER BY page."sortValue" DESC NULLS FIRST, page."id" ASC');
    },
  );

  it('rejects unsupported sort identifiers and directions before building SQL', () => {
    expect(() =>
      partyBalancePageSql(
        'org-1',
        {},
        { field: 'name; DROP TABLE Party', direction: 'asc' },
        pagination,
      ),
    ).toThrow('Unsupported');
    expect(() =>
      partyBalancePageSql(
        'org-1',
        {},
        { field: 'name', direction: 'asc; DROP TABLE Party' as never },
        pagination,
      ),
    ).toThrow('Unsupported');
  });

  it.each([
    { arbitraryColumn: 'value' },
    { name: { arbitraryOperator: 'value' } },
    { name: { mode: 'arbitrary' } },
    { name: { equals: 'Alpha', mode: 'insensitive' } },
    { debts: { every: { type: 'RECEIVABLE' } } },
    { debts: { some: { arbitraryColumn: 'value' } } },
  ])('fails closed when a future unsupported Prisma predicate reaches the adapter: %j', (where) => {
    expect(() => partyWhereSql(where as Prisma.PartyWhereInput)).toThrow('Unsupported');
  });
});
