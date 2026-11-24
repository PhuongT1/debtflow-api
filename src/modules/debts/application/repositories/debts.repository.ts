import type { ListQueryOptions } from '@common/query/list-query-options.types.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { DebtFilters } from '../../public/debt-filters.types.js';
import type {
  DebtRecord,
  DebtListRecord,
  DebtDetailRecord,
  DebtWriteData,
  CollectionUpdate,
  CancellableDebt,
  CatalogProduct,
} from '../debt-persistence.types.js';

export type DebtWriteStore = {
  hasActiveParty(organizationId: string, id: string): Promise<boolean>;
  hasActiveMember(organizationId: string, id: string): Promise<boolean>;
  products(organizationId: string, ids: string[]): Promise<CatalogProduct[]>;
  nextCode(organizationId: string, prefix: string): Promise<string>;
  create(data: DebtWriteData): Promise<DebtRecord>;
  updateCollection(organizationId: string, id: string, data: CollectionUpdate): Promise<DebtRecord>;
  findForCancellation(organizationId: string, id: string): Promise<CancellableDebt>;
  cancel(organizationId: string, id: string): Promise<DebtRecord>;
};
export abstract class DebtsRepository {
  abstract list(
    organizationId: string,
    query: DebtFilters,
    listQuery?: ListQueryOptions,
  ): Promise<PaginatedResult<DebtListRecord>>;
  abstract detail(id: string, organizationId: string): Promise<DebtDetailRecord>;
  abstract inTransaction<T>(work: (store: DebtWriteStore) => Promise<T>): Promise<T>;
}
