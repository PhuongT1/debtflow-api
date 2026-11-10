import type { PartyResponseDto, PartyListItemDto } from './dto/party-response.dto.js';
import { PARTY_RESPONSE_FIELDS } from './queries/party.select.js';
import type {
  PartyRecord,
  PartyDetail,
  PartyWithBalance,
  PartyWriteData,
  PartySearchSource,
} from './party.types.js';
import { normalizeOptionalText } from '@common/utils/optional-text.util.js';
import { Prisma } from '@generated/prisma/client.js';
import { partySearchText } from '@common/utils/search-normalization.util.js';
import type { CreatePartyDto } from './dto/create-party.dto.js';
import type { UpdatePartyDto } from './dto/update-party.dto.js';

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
function normalizePartyOptionalFields(input: UpdatePartyDto, mode: 'create' | 'update') {
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
    data.creditLimit = value === null ? null : new Prisma.Decimal(value);
  }
  return data;
}

/** Full column set for a new party. Optional values that are blank are stored as null. */
export function buildPartyCreateData(input: CreatePartyDto): PartyWriteData {
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
  input: UpdatePartyDto,
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

/** Same allow-list as Swagger. Never spread an unfiltered database record into an API response. */
export function toPartyResponse(party: PartyRecord): PartyResponseDto {
  // Object.fromEntries loses literal keys; every key/value here comes from the typed allow-list.
  const fields = Object.fromEntries(PARTY_RESPONSE_FIELDS.map((key) => [key, party[key]])) as Pick<
    PartyRecord,
    (typeof PARTY_RESPONSE_FIELDS)[number]
  >;
  return { ...fields, creditLimit: party.creditLimit?.toString() ?? null };
}

export function toPartyListItem(party: PartyWithBalance): PartyListItemDto {
  return {
    ...toPartyResponse(party),
    assignedTo: party.assignedTo,
    _count: party._count,
    balance: {
      receivable: party.balance.receivable.toString(),
      payable: party.balance.payable.toString(),
    },
  };
}

export function toPartyDetailResponse(party: PartyDetail) {
  return { ...toPartyResponse(party), assignedTo: party.assignedTo, debts: party.debts };
}
