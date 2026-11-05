import type { Party, Prisma } from '@generated/prisma/client.js';
import type { partyListInclude } from './queries/party.select.js';

export type PartySearchSource = Pick<Party, 'name' | 'code' | 'phone' | 'taxCode'>;
export type PartyWriteData = Pick<
  Prisma.PartyUncheckedCreateInput,
  | 'type'
  | 'code'
  | 'name'
  | 'searchText'
  | 'phone'
  | 'email'
  | 'taxCode'
  | 'address'
  | 'provinceCode'
  | 'provinceName'
  | 'note'
  | 'creditLimit'
  | 'assignedToId'
>;
export type PartyBalance = { receivable: Prisma.Decimal; payable: Prisma.Decimal };
export type PartyListRecord = Prisma.PartyGetPayload<{
  include: ReturnType<typeof partyListInclude>;
}>;
export type PartyWithBalance = PartyListRecord & { balance: PartyBalance };

/** Numeric columns from the owned aggregate query are returned as Prisma Decimal values. */
export type PartyBalanceRow = Pick<Party, 'id'> & PartyBalance;

export type PartyRecord = Party;
export type PartyDetail = Prisma.PartyGetPayload<{
  include: typeof import('./queries/party.select.js').PARTY_DETAIL_INCLUDE;
}>;
