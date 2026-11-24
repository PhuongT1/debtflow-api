import type { PartyResponseDto, PartyListItemDto } from './dto/party-response.dto.js';
import { PARTY_RESPONSE_FIELDS } from './dto/party-response.fields.js';
import { type PartyRecord } from '../application/party-read.types.js';
import { type PartyDetail, type PartyWithBalance } from '../application/party-read.types.js';

/** Same allow-list as Swagger. Never spread an unfiltered database record into an API response. */
export function toPartyResponse(party: PartyRecord): PartyResponseDto {
  // Object.fromEntries loses literal keys; every key/value here comes from the typed allow-list.
  const fields = Object.fromEntries(PARTY_RESPONSE_FIELDS.map((key) => [key, party[key]])) as Pick<
    PartyRecord,
    (typeof PARTY_RESPONSE_FIELDS)[number]
  >;
  return { ...fields, creditLimit: party.creditLimit };
}

export function toPartyListItem(party: PartyWithBalance): PartyListItemDto {
  return {
    ...toPartyResponse(party),
    assignedTo: party.assignedTo,
    _count: party._count,
    balance: {
      receivable: party.balance.receivable,
      payable: party.balance.payable,
    },
  };
}

export function toPartyDetailResponse(party: PartyDetail) {
  return { ...toPartyResponse(party), assignedTo: party.assignedTo, debts: party.debts };
}
