import type { PartyRecord } from '../../application/party-read.types.js';

/** Deliberate API allow-list; a new DB column must not automatically expand the response. */
export const PARTY_RESPONSE_FIELDS = [
  'id',
  'organizationId',
  'type',
  'code',
  'name',
  'searchText',
  'phone',
  'email',
  'taxCode',
  'address',
  'address2',
  'note',
  'provinceCode',
  'provinceName',
  'imageUrl',
  'isActive',
  'createdById',
  'assignedToId',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof PartyRecord)[];
