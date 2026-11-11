import type { Debt, Prisma } from '@generated/prisma/client.js';
import type { DEBT_LIST_INCLUDE, DEBT_DETAIL_INCLUDE } from '../queries/debt.select.js';

export type DebtRecord = Debt;
export type DebtListRecord = Prisma.DebtGetPayload<{ include: typeof DEBT_LIST_INCLUDE }>;
export type DebtDetailRecord = Prisma.DebtGetPayload<{ include: typeof DEBT_DETAIL_INCLUDE }>;
export type CatalogProduct = Prisma.ProductGetPayload<{ include: { brand: true; category: true } }>;
export type PreparedDebtItem = Pick<
  Prisma.DebtItemUncheckedCreateWithoutDebtInput,
  | 'productId'
  | 'productCode'
  | 'productName'
  | 'categoryName'
  | 'brandName'
  | 'quantity'
  | 'unit'
  | 'unitPrice'
  | 'lineAmount'
>;
export type DebtWriteData = Pick<
  Prisma.DebtUncheckedCreateInput,
  | 'organizationId'
  | 'code'
  | 'type'
  | 'partyId'
  | 'assignedToId'
  | 'title'
  | 'invoiceNo'
  | 'orderNo'
  | 'contractNo'
  | 'poNo'
  | 'description'
  | 'originalAmount'
  | 'paidAmount'
  | 'issueDate'
  | 'dueDate'
  | 'status'
  | 'collectionStatus'
  | 'nextFollowUpAt'
  | 'followUpNote'
  | 'salesChannel'
  | 'createdById'
> & { items?: PreparedDebtItem[] };
export type CreatedDebt = Prisma.DebtGetPayload<{ include: { party: true } }>;
export type CollectionDebt = Prisma.DebtGetPayload<{
  include: { party: true; assignedTo: { select: { id: true; name: true; email: true } } };
}>;
export type CancellableDebt = Prisma.DebtGetPayload<{ include: { paymentAllocations: true } }>;
export type CollectionUpdate = ReturnType<
  typeof import('../debt-collection.mapper.js').buildDebtCollectionData
>;
