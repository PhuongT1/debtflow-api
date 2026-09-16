import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { DebtType, PaymentMethod } from '@generated/prisma';

export class CreateAllocatedPaymentDto {
  @IsString()
  partyId!: string;

  @IsEnum(DebtType)
  type!: DebtType;

  @IsNumberString()
  amount!: string;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  referenceNo?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
