import type { DebtFilters } from '../public/debt-filters.types.js';

export type DebtLineItemInput = {
  productId?: string;
  productName?: string;
  unit?: string;
  quantity: string;
  unitPrice: string;
};

type DebtCollectionFields = {
  assignedToId?: string | null;
  invoiceNo?: string | null;
  orderNo?: string | null;
  contractNo?: string | null;
  poNo?: string | null;
  description?: string | null;
  nextFollowUpAt?: string | null;
  followUpNote?: string | null;
};

export type CreateDebtInput = DebtCollectionFields & {
  type: NonNullable<DebtFilters['type']>;
  partyId: string;
  title: string;
  salesChannel?: DebtFilters['salesChannel'];
  items?: DebtLineItemInput[];
  originalAmount: string;
  issueDate: string;
  dueDate: string;
};

export type UpdateDebtCollectionInput = DebtCollectionFields & {
  collectionStatus?: DebtFilters['collectionStatus'];
};
