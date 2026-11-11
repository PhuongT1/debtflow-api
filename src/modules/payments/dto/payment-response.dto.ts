import { PickType } from '@nestjs/swagger';
import { PartyResponseDto } from '@modules/parties/dto/party-response.dto.js';
import { DebtWithPartyDto } from '@modules/debts/public/debt-responses.js';
import {
  PaymentRecordDto,
  PaymentWithCreatorDto,
  PaymentAllocationRecordDto,
} from './payment-record.dto.js';

export class PaymentPartyDto extends PickType(PartyResponseDto, ['id', 'name'] as const) {}
export class PaymentAllocationResponseDto extends PaymentAllocationRecordDto {
  debt!: DebtWithPartyDto;
}
export class PaymentResponseDto extends PaymentWithCreatorDto {
  party!: PaymentPartyDto;
  allocations!: PaymentAllocationResponseDto[];
}
export class PaymentWithPartyDto extends PaymentRecordDto {
  party!: PartyResponseDto;
}
export class PaymentReversalResponseDto {
  id!: string;
  restoredDebtCount!: number;
}
