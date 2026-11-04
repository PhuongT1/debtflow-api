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
import { DebtType, SalesChannel } from '#generated/prisma/client.js';
import { Type } from 'class-transformer';
import { CreateDebtItemDto } from './items/create-debt-item.dto.js';

export class CreateDebtDto {
  @IsEnum(DebtType)
  type!: DebtType;

  @IsString()
  @IsNotEmpty()
  partyId!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string | null;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string | null;

  @IsOptional()
  @IsString()
  orderNo?: string | null;

  @IsOptional()
  @IsString()
  contractNo?: string | null;

  @IsOptional()
  @IsString()
  poNo?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

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
  nextFollowUpAt?: string | null;

  @IsOptional()
  @IsString()
  followUpNote?: string | null;
}
