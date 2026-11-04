import { ApiProperty } from '@nestjs/swagger';
import { DEBT_AGING_VALUES } from '../rules/debt-aging.rules.js';
import type { DebtAging } from '../types/debt-aging.types.js';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto.js';
import { CollectionStatus, DebtStatus, DebtType, SalesChannel } from '@generated/prisma/client.js';

export class QueryDebtsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(DebtType)
  type?: DebtType;

  @IsOptional()
  @IsEnum(DebtStatus)
  status?: DebtStatus;

  @IsOptional()
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;

  @IsOptional()
  @IsString()
  partyId?: string;

  @IsOptional()
  @IsString()
  provinceCode?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(SalesChannel)
  salesChannel?: SalesChannel;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @ApiProperty({
    required: false,
    enum: DEBT_AGING_VALUES,
    description: 'Vietnam calendar-day aging; due today is not overdue.',
  })
  @IsIn(DEBT_AGING_VALUES)
  aging?: DebtAging;

  @IsOptional()
  @IsIn(['today', 'overdue', 'upcoming'])
  followUp?: 'today' | 'overdue' | 'upcoming';

  @IsOptional()
  @IsIn(['today', 'tomorrow', 'next_7_days', 'this_month'])
  dueRange?: 'today' | 'tomorrow' | 'next_7_days' | 'this_month';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  overdue?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false'])
  outstanding?: 'true' | 'false';
}
