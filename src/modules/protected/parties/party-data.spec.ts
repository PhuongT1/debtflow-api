import { describe, expect, it } from 'vitest';
import { PartyType } from '@generated/prisma';
import { buildPartyCreateData, buildPartyUpdateData } from './party-data';

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
