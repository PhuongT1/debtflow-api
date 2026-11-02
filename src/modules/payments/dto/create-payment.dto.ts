import { IsDateString, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '@generated/prisma';

export class CreatePaymentDto {
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
