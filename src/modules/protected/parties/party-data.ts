import { Prisma, type PartyType } from '@generated/prisma';
import { partySearchText } from '@common/utils/search-normalization.util';
import type { CreatePartyDto } from './dto/create-party.dto';
import type { UpdatePartyDto } from './dto/update-party.dto';

type PartyFields = Omit<Prisma.PartyUncheckedCreateInput, 'organizationId'>;

/** Columns the search text is derived from. */
export type PartySearchSource = {
  name: string;
  code: string | null;
  phone: string | null;
  taxCode: string | null;
};

const blankToNull = (value: unknown): string | null => {
  const text = String(value ?? '').trim();

  return text.length > 0 ? text : null;
};

const toCreditLimit = (value: unknown) => {
  const text = blankToNull(value);

  return text === null ? null : new Prisma.Decimal(text);
};

/** Full column set for a new party. Optional values that are blank are stored as null. */
export function buildPartyCreateData(input: CreatePartyDto): PartyFields {
  const name = input.name.trim();
  const code = blankToNull(input.code);
  const phone = blankToNull(input.phone);
  const taxCode = blankToNull(input.taxCode);

  return {
    type: input.type as PartyType,
    code,
    name,
    searchText: partySearchText(name, code, phone, taxCode),
    phone,
    email: blankToNull(input.email)?.toLowerCase() ?? null,
    taxCode,
    address: blankToNull(input.address),
    provinceCode: blankToNull(input.provinceCode)?.toUpperCase() ?? null,
    provinceName: blankToNull(input.provinceName),
    note: blankToNull(input.note),
    creditLimit: toCreditLimit(input.creditLimit),
    assignedToId: blankToNull(input.assignedToId),
  };
}

/**
 * Columns to change for a PATCH. Only keys present in the request are touched: an absent key keeps
 * the stored value, a blank or null value clears an optional column. `name` and `type` cannot be cleared.
 */
export function buildPartyUpdateData(
  input: UpdatePartyDto,
  current: PartySearchSource,
): Partial<PartyFields> {
  const data: Partial<PartyFields> = {};
  const has = (key: keyof UpdatePartyDto) => input[key] !== undefined;

  // An explicit null cannot clear these two required columns: it is treated as "not sent".
  if (input.type != null) data.type = input.type as PartyType;
  if (input.name != null) data.name = String(input.name).trim();
  if (has('code')) data.code = blankToNull(input.code);
  if (has('phone')) data.phone = blankToNull(input.phone);
  if (has('email')) data.email = blankToNull(input.email)?.toLowerCase() ?? null;
  if (has('taxCode')) data.taxCode = blankToNull(input.taxCode);
  if (has('address')) data.address = blankToNull(input.address);
  if (has('note')) data.note = blankToNull(input.note);
  if (has('provinceCode'))
    data.provinceCode = blankToNull(input.provinceCode)?.toUpperCase() ?? null;
  if (has('provinceName')) data.provinceName = blankToNull(input.provinceName);
  if (has('creditLimit')) data.creditLimit = toCreditLimit(input.creditLimit);
  if (has('assignedToId')) data.assignedToId = blankToNull(input.assignedToId);

  const searchChanged = input.name != null || has('code') || has('phone') || has('taxCode');

  if (searchChanged) {
    data.searchText = partySearchText(
      (data.name as string | undefined) ?? current.name,
      has('code') ? (data.code as string | null) : current.code,
      has('phone') ? (data.phone as string | null) : current.phone,
      has('taxCode') ? (data.taxCode as string | null) : current.taxCode,
    );
  }

  return data;
}
