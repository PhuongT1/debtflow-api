import type { Party, Prisma } from '@generated/prisma';
import type { PARTY_LIST_INCLUDE } from '../queries/party.select';

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
export type PartyListRecord = Prisma.PartyGetPayload<{ include: typeof PARTY_LIST_INCLUDE }>;
export type PartyWithBalance = PartyListRecord & { balance: PartyBalance };
