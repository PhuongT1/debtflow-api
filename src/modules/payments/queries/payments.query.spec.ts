import { describe, expect, it } from 'vitest';
import { parseListQuery } from '#common/query/index.js';
import { buildPaymentsQuery } from './payments.query.js';
import { PAYMENT_LIST_QUERY } from './payments.list-query.js';

describe('payment list query ownership', () => {
  it.each([undefined, null, '', ' '])('rejects missing tenant %s', (organizationId) => {
    expect(() => buildPaymentsQuery(organizationId as never, {})).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
  it('keeps named filters together and defaults to a stable date/id order', () => {
    expect(buildPaymentsQuery('org-1', { debtId: 'd1', partyId: 'p1' })).toEqual({
      where: { organizationId: 'org-1', partyId: 'p1', allocations: { some: { debtId: 'd1' } } },
      orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
    });
  });
  it('intersects dynamic OR filters with the tenant and named party filter', () => {
    const parsed = parseListQuery(
      {
        'filter[partyId][eq]': 'foreign-party',
        'filter[referenceNo][contains]': 'invoice',
        filterOperator: 'OR',
        sortBy: 'amount',
        sortOrder: 'desc',
      },
      PAYMENT_LIST_QUERY,
    );
    expect(buildPaymentsQuery('org-1', { partyId: 'p1' }, parsed)).toEqual({
      where: { AND: [{ organizationId: 'org-1', partyId: 'p1' }, parsed.where] },
      orderBy: parsed.orderBy,
    });
    expect(parsed.orderBy).toEqual([{ amount: 'desc' }, { id: 'asc' }]);
  });
});
