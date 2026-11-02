import { CollectionStatus, DebtStatus, DebtType, SalesChannel } from '@generated/prisma';

/** Public scalar debt contract; relations are added by the use-case response DTO. */
export class DebtRecordDto {
  id!: string;
  organizationId!: string;
  code!: string;
  type!: DebtType;
  partyId!: string;
  assignedToId!: string | null;
  title!: string;
  invoiceNo!: string | null;
  orderNo!: string | null;
  contractNo!: string | null;
  poNo!: string | null;
  description!: string | null;
  /** Decimal string. */
  originalAmount!: string;
  /** Decimal string. */
  paidAmount!: string;
  currency!: string;
  salesChannel!: SalesChannel | null;
  issueDate!: Date;
  dueDate!: Date;
  status!: DebtStatus;
  collectionStatus!: CollectionStatus;
  nextFollowUpAt!: Date | null;
  followUpNote!: string | null;
  createdById!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class DebtItemRecordDto {
  id!: string;
  debtId!: string;
  productId!: string | null;
  productCode!: string | null;
  productName!: string;
  categoryName!: string | null;
  brandName!: string | null;
  /** Decimal string. */
  quantity!: string;
  unit!: string;
  /** Decimal string. */
  unitPrice!: string;
  /** Decimal string. */
  lineAmount!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
