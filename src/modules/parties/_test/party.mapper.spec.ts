import { describe, expect, it } from 'vitest';
import { PartyType, Prisma } from '@generated/prisma/client.js';
import type { PartyRecord } from '../party.types.js';
import {
  buildPartyCreateData,
  buildPartyUpdateData,
  toPartyResponse,
  toPartyListItem,
  toPartyDetailResponse,
} from '../party.mapper.js';

const current = {
  name: 'Boutique An Nhiên',
  code: 'CUS-01',
  phone: '0283910011',
  taxCode: null,
};

describe('buildPartyCreateData', () => {
  it('trims, normalizes and stores blank optionals as null', () => {
    const data = buildPartyCreateData({
      type: PartyType.CUSTOMER,
      name: '  Boutique An Nhiên ',
      code: '  ',
      email: ' Contact@AN-Nhien.VN ',
      provinceCode: ' hcm ',
      creditLimit: '1500000.50',
    });

    expect(data).toMatchObject({
      type: 'CUSTOMER',
      name: 'Boutique An Nhiên',
      code: null,
      email: 'contact@an-nhien.vn',
      provinceCode: 'HCM',
      phone: null,
      searchText: 'boutique an nhien',
    });
    expect(String(data.creditLimit)).toBe('1500000.5');
  });

  it('derives accent-insensitive search text from name, code, phone and tax code', () => {
    const data = buildPartyCreateData({
      type: PartyType.SUPPLIER,
      name: 'Công ty Đông Nam',
      code: 'SUP-9',
      phone: '0901',
      taxCode: '0312',
    });

    expect(data.searchText).toBe('cong ty dong nam sup-9 0901 0312');
  });
});

describe('buildPartyUpdateData', () => {
  it.each([
    'code',
    'phone',
    'email',
    'taxCode',
    'address',
    'note',
    'provinceCode',
    'provinceName',
    'assignedToId',
  ] as const)(
    'preserves an omitted %s and clears it only when explicitly sent blank/null',
    (field) => {
      expect(buildPartyUpdateData({ [field]: undefined }, current)).toEqual({});
      expect(buildPartyUpdateData({ [field]: '   ' }, current)[field]).toBeNull();
      expect(buildPartyUpdateData({ [field]: null }, current)[field]).toBeNull();
    },
  );

  it('maps only writable fields and keeps a zero credit limit instead of clearing it', () => {
    const input = {
      organizationId: 'foreign-org',
      createdById: 'other-user',
      isActive: false,
      creditLimit: '0',
    };
    const data = buildPartyUpdateData(input, current);
    expect(Object.keys(data)).toEqual(['creditLimit']);
    expect(data.creditLimit).toBeInstanceOf(Prisma.Decimal);
    expect(String(data.creditLimit)).toBe('0');
  });

  it('changes only the keys that were sent (no wiping of other columns)', () => {
    expect(buildPartyUpdateData({ note: 'only note' }, current)).toEqual({ note: 'only note' });
    expect(buildPartyUpdateData({}, current)).toEqual({});
  });

  it('ignores a null name or type instead of storing "null"', () => {
    expect(buildPartyUpdateData({ name: null as never, type: null as never }, current)).toEqual({});
  });

  it('clears an optional column with a blank value but never name or type', () => {
    expect(buildPartyUpdateData({ phone: '', creditLimit: '' }, current)).toMatchObject({
      phone: null,
      creditLimit: null,
    });
    const data = buildPartyUpdateData({ note: 'x' }, current);
    expect('name' in data).toBe(false);
    expect('type' in data).toBe(false);
  });

  it('recomputes search text from the merged values when a searched column changes', () => {
    expect(buildPartyUpdateData({ phone: '0777' }, current).searchText).toBe(
      'boutique an nhien cus-01 0777',
    );
    expect(buildPartyUpdateData({ name: 'Cửa hàng Mới' }, current).searchText).toBe(
      'cua hang moi cus-01 0283910011',
    );
    expect(buildPartyUpdateData({ code: null as never }, current).searchText).toBe(
      'boutique an nhien 0283910011',
    );
  });

  it('does not touch the search text when no searched column changes', () => {
    expect('searchText' in buildPartyUpdateData({ address: 'HN', email: 'A@B.C' }, current)).toBe(
      false,
    );
  });

  it('normalizes email and province code on update', () => {
    expect(buildPartyUpdateData({ email: 'A@B.VN', provinceCode: 'hn' }, current)).toMatchObject({
      email: 'a@b.vn',
      provinceCode: 'HN',
    });
  });
});

const partyRecord = {
  id: 'party-1',
  organizationId: 'org-1',
  type: PartyType.CUSTOMER,
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
  creditLimit: new Prisma.Decimal('9999999999999999.99'),
} satisfies PartyRecord;

describe('party response mapping', () => {
  it('keeps the explicit API contract and strips unknown database fields without mutating the record', () => {
    const record = { ...partyRecord, internalNote: 'not public' };
    const response = toPartyResponse(record);
    expect(response).not.toHaveProperty('internalNote');
    expect(response.creditLimit).toBe('9999999999999999.99');
    expect(response.phone).toBeNull();
    expect(response.createdAt).toBe(record.createdAt);
    expect(record.creditLimit).toBeInstanceOf(Prisma.Decimal);
    expect(toPartyResponse({ ...record, creditLimit: null }).creditLimit).toBeNull();
  });

  it('preserves list relations/counts and converts monetary balances without number rounding', () => {
    const response = toPartyListItem({
      ...partyRecord,
      assignedTo: null,
      _count: { debts: 3 },
      balance: {
        receivable: new Prisma.Decimal('9999999999999999.99'),
        payable: new Prisma.Decimal(0),
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
