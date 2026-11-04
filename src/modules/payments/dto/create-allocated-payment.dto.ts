import { IsEnum, IsString } from 'class-validator';
import { DebtType } from '#generated/prisma/client.js';
import { CreatePaymentDto } from './create-payment.dto.js';

export class CreateAllocatedPaymentDto extends CreatePaymentDto {
  @IsString()
  partyId!: string;

  @IsEnum(DebtType)
  type!: DebtType;
}
