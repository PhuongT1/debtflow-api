import { DebtType, PaymentMethod } from '@generated/prisma/client.js';
import { UserSummaryDto } from '@modules/users/public/users.js';

export class PaymentRecordDto {
  id!: string;
  organizationId!: string;
  partyId!: string;
  type!: DebtType;
  /** Decimal string; for a debt's payments view this is the amount allocated to that debt. */
  amount!: string;
  paidAt!: Date;
  method!: PaymentMethod;
  referenceNo!: string | null;
  note!: string | null;
  createdById!: string | null;
  createdAt!: Date;
}
export class PaymentWithCreatorDto extends PaymentRecordDto {
  createdBy!: UserSummaryDto | null;
}
export class PaymentAllocationRecordDto {
  id!: string;
  paymentId!: string;
  debtId!: string;
  /** Decimal string. */
  amount!: string;
  createdAt!: Date;
}
