import type { CreatePartyInput, UpdatePartyInput, PartyWriteData } from './party.inputs.js';
import type { PartyRecord } from './party-read.types.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { partySearchText } from '@common/utils/search-normalization.util.js';

type PartySearchSource = Pick<PartyRecord, 'name' | 'code' | 'phone' | 'taxCode'>;

const OPTIONAL_TEXT_FIELDS = [
  'code',
  'phone',
  'email',
  'taxCode',
  'address',
  'note',
  'provinceCode',
  'provinceName',
  'assignedToId',
] as const;

/** Shared writable-field normalization. PATCH never normalizes or writes an omitted field. */
function normalizePartyOptionalFields(input: UpdatePartyInput, mode: 'create' | 'update') {
  const data: Partial<PartyWriteData> = {};
  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (mode === 'update' && input[field] === undefined) continue;
    let value = normalizeOptionalText(input[field]);
    if (field === 'email') value = value?.toLowerCase() ?? null;
    if (field === 'provinceCode') value = value?.toUpperCase() ?? null;
    data[field] = value;
  }
  if (mode === 'create' || input.creditLimit !== undefined) {
    const value = normalizeOptionalText(input.creditLimit);
    data.creditLimit = value;
  }
  return data;
}

/** Full column set for a new party. Optional values that are blank are stored as null. */
export function buildPartyCreateData(input: CreatePartyInput): PartyWriteData {
  const data = normalizePartyOptionalFields(input, 'create');
  const name = input.name.trim();
  return {
    ...data,
    type: input.type,
    name,
    searchText: partySearchText(name, data.code, data.phone, data.taxCode),
  };
}

/** PATCH preserves omitted fields; null/blank clears optional fields, never name/type. */
export function buildPartyUpdateData(
  input: UpdatePartyInput,
  current: PartySearchSource,
): Partial<PartyWriteData> {
  const data = normalizePartyOptionalFields(input, 'update');
  // Preserve the existing API's no-op semantics for null required fields.
  if (input.type != null) data.type = input.type;
  if (input.name != null) data.name = input.name.trim();

  if (['name', 'code', 'phone', 'taxCode'].some((field) => Object.hasOwn(data, field))) {
    const merged = { ...current, ...data };
    data.searchText = partySearchText(merged.name, merged.code, merged.phone, merged.taxCode);
  }
  return data;
}
