import type { DecimalAmount } from '@common/utils/decimal-amount.types.js';
import type { CreateDebtInput, UpdateDebtCollectionInput } from './debt-inputs.types.js';
import type { DebtFilters } from '../public/debt-filters.types.js';

export type DebtRecord = { id: string };
export type DebtListRecord = DebtRecord & {
  code: string;
  type: NonNullable<DebtFilters['type']>;
  status: NonNullable<DebtFilters['status']>;
  party: { name: string };
  originalAmount: DecimalAmount;
  paidAmount: DecimalAmount;
  dueDate: Date;
};
export type DebtDetailRecord = DebtRecord & {
  paymentAllocations: { amount: DecimalAmount; payment: { id: string } }[];
};
export type CancellableDebt = DebtRecord & { paymentAllocations: { id: string }[] };

export type CatalogProduct = {
  id: string;
  name: string;
  code: string;
  unit: string;
  category: { name: string };
  brand: { name: string } | null;
};
export type PreparedDebtItem = {
  productId?: string;
  productCode?: string;
  productName: string;
  categoryName?: string;
  brandName?: string;
  quantity: DecimalAmount;
  unit: string;
  unitPrice: DecimalAmount;
  lineAmount: DecimalAmount;
};

export type DebtWriteData = Omit<
  CreateDebtInput,
  'items' | 'originalAmount' | 'issueDate' | 'dueDate' | 'nextFollowUpAt'
> & {
  organizationId: string;
  code: string;
  originalAmount: DecimalAmount;
  paidAmount: DecimalAmount;
  issueDate: Date;
  dueDate: Date;
  status: NonNullable<DebtFilters['status']>;
  collectionStatus: NonNullable<DebtFilters['collectionStatus']>;
  nextFollowUpAt: Date | null;
  createdById: string;
  items?: PreparedDebtItem[];
};

export type CollectionUpdate = Omit<UpdateDebtCollectionInput, 'nextFollowUpAt'> & {
  nextFollowUpAt?: Date | null;
};
