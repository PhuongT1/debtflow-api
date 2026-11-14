import { PickType } from '@nestjs/swagger';
import { PartyResponseDto } from '@modules/parties/presentation/dto/party-response.dto.js';
import { UserSummaryDto } from '@modules/users/public/users.js';
import { ProductResponseDto } from '@modules/catalog/public/catalog.js';
import {
  PaymentWithCreatorDto,
  PaymentAllocationRecordDto,
} from '@modules/payments/public/payment-records.js';
import { DebtRecordDto, DebtItemRecordDto } from './debt-record.dto.js';

export class DebtWithPartyDto extends DebtRecordDto {
  party!: PartyResponseDto;
}
export class DebtCollectionResponseDto extends DebtWithPartyDto {
  assignedTo!: UserSummaryDto | null;
}
export class DebtListItemDto extends PickType(DebtItemRecordDto, [
  'id',
  'productName',
  'categoryName',
  'brandName',
  'quantity',
  'unit',
  'lineAmount',
] as const) {}
export class DebtPaymentCountDto {
  paymentAllocations!: number;
}
export class DebtListResponseDto extends DebtCollectionResponseDto {
  items!: DebtListItemDto[];
  _count!: DebtPaymentCountDto;
}
export class DebtItemDetailDto extends DebtItemRecordDto {
  product!: ProductResponseDto | null;
}
export class DebtAllocationWithPaymentDto extends PaymentAllocationRecordDto {
  payment!: PaymentWithCreatorDto;
}
export class DebtDetailResponseDto extends DebtCollectionResponseDto {
  items!: DebtItemDetailDto[];
  paymentAllocations!: DebtAllocationWithPaymentDto[];
  /** Payment amount is the allocation for this debt, rather than the full voucher amount. */
  payments!: PaymentWithCreatorDto[];
}
