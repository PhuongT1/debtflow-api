import type { ListQueryResult } from '@common/query/index.js';
import type { PaginatedResult } from '@common/utils/pagination.util.js';
import type { QueryDebtsDto } from '../dto/query-debts.dto.js';
import type {
  DebtRecord,
  DebtListRecord,
  DebtDetailRecord,
  DebtWriteData,
  CreatedDebt,
  CollectionDebt,
  CollectionUpdate,
  CancellableDebt,
  CatalogProduct,
} from '../types/debt-persistence.types.js';

export type DebtWriteStore = {
  hasActiveParty(organizationId: string, id: string): Promise<boolean>;
  hasActiveMember(organizationId: string, id: string): Promise<boolean>;
  products(organizationId: string, ids: string[]): Promise<CatalogProduct[]>;
  nextCode(organizationId: string, prefix: string): Promise<string>;
  create(data: DebtWriteData): Promise<CreatedDebt>;
  updateCollection(
    organizationId: string,
    id: string,
    data: CollectionUpdate,
  ): Promise<CollectionDebt>;
  findForCancellation(organizationId: string, id: string): Promise<CancellableDebt>;
  cancel(organizationId: string, id: string): Promise<DebtRecord>;
};
export abstract class DebtsRepository {
  abstract list(
    organizationId: string,
    query: QueryDebtsDto,
    listQuery?: ListQueryResult,
  ): Promise<PaginatedResult<DebtListRecord>>;
  abstract detail(id: string, organizationId: string): Promise<DebtDetailRecord>;
  abstract inTransaction<T>(work: (store: DebtWriteStore) => Promise<T>): Promise<T>;
}
