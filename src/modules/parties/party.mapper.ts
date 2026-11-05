import type { PartyWriteData, PartySearchSource } from './party.types.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { Prisma } from '@generated/prisma/client.js';
import { partySearchText } from '@common/utils/search-normalization.util.js';
import type { CreatePartyDto } from './dto/create-party.dto.js';
import type { UpdatePartyDto } from './dto/update-party.dto.js';

const toCreditLimit = (value: string | null | undefined) => {
  const text = normalizeOptionalText(value);

  return text === null ? null : new Prisma.Decimal(text);
};

/** Full column set for a new party. Optional values that are blank are stored as null. */
export function buildPartyCreateData(input: CreatePartyDto): PartyWriteData {
  const name = input.name.trim();
  const code = normalizeOptionalText(input.code);
  const phone = normalizeOptionalText(input.phone);
  const taxCode = normalizeOptionalText(input.taxCode);

  return {
    type: input.type,
    code,
    name,
    searchText: partySearchText(name, code, phone, taxCode),
    phone,
    email: normalizeOptionalText(input.email)?.toLowerCase() ?? null,
    taxCode,
    address: normalizeOptionalText(input.address),
    provinceCode: normalizeOptionalText(input.provinceCode)?.toUpperCase() ?? null,
    provinceName: normalizeOptionalText(input.provinceName),
    note: normalizeOptionalText(input.note),
    creditLimit: toCreditLimit(input.creditLimit),
    assignedToId: normalizeOptionalText(input.assignedToId),
  };
}

/**
 * Columns to change for a PATCH. Only keys present in the request are touched: an absent key keeps
 * the stored value, a blank or null value clears an optional column. `name` and `type` cannot be cleared.
 */
export function buildPartyUpdateData(
  input: UpdatePartyDto,
  current: PartySearchSource,
): Partial<PartyWriteData> {
  const data: Partial<PartyWriteData> = {};
  const has = (key: keyof UpdatePartyDto) => input[key] !== undefined;

  // An explicit null cannot clear these two required columns: it is treated as "not sent".
  if (input.type != null) data.type = input.type;
  if (input.name != null) data.name = String(input.name).trim();
  if (has('code')) data.code = normalizeOptionalText(input.code);
  if (has('phone')) data.phone = normalizeOptionalText(input.phone);
  if (has('email')) data.email = normalizeOptionalText(input.email)?.toLowerCase() ?? null;
  if (has('taxCode')) data.taxCode = normalizeOptionalText(input.taxCode);
  if (has('address')) data.address = normalizeOptionalText(input.address);
  if (has('note')) data.note = normalizeOptionalText(input.note);
  if (has('provinceCode'))
    data.provinceCode = normalizeOptionalText(input.provinceCode)?.toUpperCase() ?? null;
  if (has('provinceName')) data.provinceName = normalizeOptionalText(input.provinceName);
  if (has('creditLimit')) data.creditLimit = toCreditLimit(input.creditLimit);
  if (has('assignedToId')) data.assignedToId = normalizeOptionalText(input.assignedToId);

  const searchChanged = input.name != null || has('code') || has('phone') || has('taxCode');

  if (searchChanged) {
    data.searchText = partySearchText(
      data.name ?? current.name,
      has('code') ? data.code : current.code,
      has('phone') ? data.phone : current.phone,
      has('taxCode') ? data.taxCode : current.taxCode,
    );
  }

  return data;
}
