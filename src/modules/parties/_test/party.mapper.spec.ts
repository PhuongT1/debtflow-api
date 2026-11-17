import { describe, expect, it } from 'vitest';
import type { PartyRecord } from '../application/party-read.types.js';
import {
  toPartyResponse,
  toPartyListItem,
  toPartyDetailResponse,
} from '../presentation/party.mapper.js';

const partyRecord = {
  id: 'party-1',
  organizationId: 'org-1',
  type: 'CUSTOMER',
  name: 'An Phú',
  code: null,
  searchText: 'an phu',
  phone: null,
  email: null,
  taxCode: null,
  address: null,
  address2: null,
  note: null,
  provinceCode: null,
  provinceName: null,
  imageUrl: null,
  isActive: true,
  createdById: null,
  assignedToId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  creditLimit: '9999999999999999.99',
} satisfies PartyRecord;

describe('party response mapping', () => {
  it('keeps the explicit API contract and strips unknown database fields without mutating the record', () => {
    const record = { ...partyRecord, internalNote: 'not public' };
    const response = toPartyResponse(record);
    expect(response).not.toHaveProperty('internalNote');
    expect(response.creditLimit).toBe('9999999999999999.99');
    expect(response.phone).toBeNull();
    expect(response.createdAt).toBe(record.createdAt);
    expect(record.creditLimit).toBe('9999999999999999.99');
    expect(toPartyResponse({ ...record, creditLimit: null }).creditLimit).toBeNull();
  });

  it('preserves list relations/counts and converts monetary balances without number rounding', () => {
    const response = toPartyListItem({
      ...partyRecord,
      assignedTo: null,
      _count: { debts: 3 },
      balance: {
        receivable: '9999999999999999.99',
        payable: '0',
      },
    });
    expect(response.balance).toEqual({ receivable: '9999999999999999.99', payable: '0' });
    expect(response._count.debts).toBe(3);
    expect(response.assignedTo).toBeNull();
  });

  it('keeps the detail relation contract while mapping party scalar fields', () => {
    const response = toPartyDetailResponse({ ...partyRecord, assignedTo: null, debts: [] });
    expect(response.debts).toEqual([]);
    expect(response.assignedTo).toBeNull();
    expect(response.creditLimit).toBe('9999999999999999.99');
  });
});
