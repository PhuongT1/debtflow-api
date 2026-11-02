import { IsEnum, IsString } from 'class-validator';
import { DebtType } from '@generated/prisma';
import { CreatePaymentDto } from './create-payment.dto';

export class CreateAllocatedPaymentDto extends CreatePaymentDto {
  @IsString()
  partyId!: string;

  @IsEnum(DebtType)
  type!: DebtType;
}
