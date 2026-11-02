import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DebtType, SalesChannel } from '@generated/prisma';
import { Type } from 'class-transformer';
import { CreateDebtItemDto } from './items/create-debt-item.dto';

export class CreateDebtDto {
  @IsEnum(DebtType)
  type!: DebtType;

  @IsString()
  @IsNotEmpty()
  partyId!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  contractNo?: string;

  @IsOptional()
  @IsString()
  poNo?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SalesChannel)
  salesChannel?: SalesChannel;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDebtItemDto)
  items?: CreateDebtItemDto[];

  @IsNumberString()
  originalAmount!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  followUpNote?: string;
}
