import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { PartyListInput, PartyWriteData } from '../party.inputs.js';
import type { PartyRecord, PartyDetail, PartyWithBalance } from '../party-read.types.js';

/** Operations bound to one write transaction; no Prisma client crosses this contract. */
export type PartyWriteStore = {
  findRecord(organizationId: string, id: string): Promise<PartyRecord>;
  hasActiveMember(organizationId: string, userId: string): Promise<boolean>;
  update(organizationId: string, id: string, data: Partial<PartyWriteData>): Promise<PartyRecord>;
  countActiveDebts(organizationId: string, partyId: string): Promise<number>;
  deactivate(organizationId: string, id: string): Promise<PartyRecord>;
};

export abstract class PartiesRepository {
  abstract list(
    organizationId: string,
    query: PartyListInput,
    listQuery?: ListQueryOptions,
  ): Promise<PaginatedResult<PartyWithBalance>>;
  abstract detail(organizationId: string, id: string): Promise<PartyDetail>;
  abstract isActive(organizationId: string, id: string): Promise<boolean>;
  abstract create(
    organizationId: string,
    userId: string,
    data: PartyWriteData,
  ): Promise<PartyRecord>;
  abstract inTransaction<T>(work: (store: PartyWriteStore) => Promise<T>): Promise<T>;
}
