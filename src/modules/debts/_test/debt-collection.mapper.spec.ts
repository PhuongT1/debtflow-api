import { describe, expect, it } from 'vitest';
import { buildDebtCollectionData } from '../debt-collection.mapper.js';

describe('collection PATCH mapping', () => {
  it('does not write omitted nullable fields when changing only status', () => {
    expect(buildDebtCollectionData({ collectionStatus: 'CONTACTED' })).toEqual({
      collectionStatus: 'CONTACTED',
    });
    expect(buildDebtCollectionData({})).toEqual({});
  });
  it('clears explicitly nullable fields and trims submitted values', () => {
    expect(
      buildDebtCollectionData({
        assignedToId: null,
        nextFollowUpAt: null,
        invoiceNo: '  ',
        description: null,
        followUpNote: ' call ',
      }),
    ).toEqual({
      assignedToId: null,
      nextFollowUpAt: null,
      invoiceNo: null,
      description: null,
      followUpNote: 'call',
    });
    expect(buildDebtCollectionData({ nextFollowUpAt: '2026-11-01T05:00:00Z' })).toEqual({
      nextFollowUpAt: new Date('2026-11-01T05:00:00Z'),
    });
  });
});
