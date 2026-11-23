import type { PartyRecord, PartyType } from './party-read.types.js';
import type { Pagination } from '@common/utils/pagination.util.js';

type PartyOptionalInputField =
  | 'code'
  | 'phone'
  | 'email'
  | 'taxCode'
  | 'address'
  | 'note'
  | 'provinceCode'
  | 'provinceName'
  | 'creditLimit'
  | 'assignedToId';
export type CreatePartyInput = Pick<PartyRecord, 'type' | 'name'> &
  Partial<Pick<PartyRecord, PartyOptionalInputField>>;
export type UpdatePartyInput = Partial<Omit<CreatePartyInput, 'name' | 'type'>> & {
  name?: PartyRecord['name'] | null;
  type?: PartyRecord['type'] | null;
};
export type PartyWriteData = CreatePartyInput & Pick<PartyRecord, 'searchText'>;

export const PARTY_CREATED_RANGES = ['today', 'last_7_days', 'this_month'] as const;
export type PartyCreatedRange = (typeof PARTY_CREATED_RANGES)[number];

export type PartyListInput = Partial<Pick<Pagination, 'page' | 'pageSize'>> & {
  q?: string;
  type?: PartyType;
  assignedToId?: string;
  balanceType?: 'RECEIVABLE' | 'PAYABLE';
  createdRange?: PartyCreatedRange;
  createdFrom?: string;
  createdTo?: string;
};
