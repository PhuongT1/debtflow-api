import { describe, expect, it } from 'vitest';
import { Prisma } from '#generated/prisma/client.js';
import { parseListQuery, validFieldsOf, type FieldType } from '#common/query/index.js';
import { partyBalancePageSql } from './party-balance-page.query.js';
import { partyWhereSql } from './party-filter.sql.js';
import { buildPartyQuery } from './parties.query.js';
import { PARTY_LIST_QUERY } from './parties.list-query.js';

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
    expect(sql.values.slice(-2)).toEqual([20, 40]);
    expect(sql.text).toMatch(/ORDER BY[\s\S]+p\."id" ASC LIMIT \$\d+ OFFSET \$\d+/);
    expect(sql.text).not.toContain('p.*');
  });

  it.each(validFieldsOf(PARTY_LIST_QUERY, 'sortable'))(
    'has an SQL implementation for declared sort %s',
    (field) => {
      const parsed = parseListQuery({ sortBy: field }, PARTY_LIST_QUERY);
      expect(() =>
        partyBalancePageSql('org-1', { organizationId: 'org-1' }, parsed.sort[0], pagination),
      ).not.toThrow();
    },
  );

  it.each(validFieldsOf(PARTY_LIST_QUERY, 'filterable'))(
    'has an SQL implementation for declared scalar filter %s',
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
      const parsed = parseListQuery(
        {
          sortBy: 'receivable',
          sortOrder: 'desc',
          [`filter[${field}][eq]`]: sample[definition.type],
        },
        PARTY_LIST_QUERY,
      );
      const { where } = buildPartyQuery('org-1', {}, parsed);
      expect(() => partyBalancePageSql('org-1', where, parsed.sort[0], pagination)).not.toThrow();
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
