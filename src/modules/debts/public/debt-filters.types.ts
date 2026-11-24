import type { PaginationInput } from '@common/utils/pagination.util.js';

export const DEBT_AGING_VALUES = ['not_due', '1_7', '8_30', '31_60', '60_plus'] as const;
export type DebtAging = (typeof DEBT_AGING_VALUES)[number];

export type DebtFilters = PaginationInput & {
  q?: string;
  type?: 'RECEIVABLE' | 'PAYABLE';
  status?: 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  collectionStatus?: 'NEW' | 'CONTACTED' | 'PROMISED' | 'DISPUTED' | 'ESCALATED';
  salesChannel?: 'STORE' | 'ONLINE' | 'WHOLESALE';
  partyId?: string;
  provinceCode?: string;
  categoryId?: string;
  brandId?: string;
  productId?: string;
  assignedToId?: string;
  aging?: DebtAging;
  followUp?: 'today' | 'overdue' | 'upcoming';
  dueRange?: 'today' | 'tomorrow' | 'next_7_days' | 'this_month';
  dueDate?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdue?: 'true' | 'false';
  outstanding?: 'true' | 'false';
};
