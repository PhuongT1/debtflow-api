import { IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { DebtType, PartyType } from '@generated/prisma';

export enum PartySummarySortBy {
  NAME = 'name',
  OUTSTANDING_DOCUMENTS = 'outstandingDocuments',
  RECEIVABLE = 'receivable',
  PAYABLE = 'payable',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class QueryPartiesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(PartyType)
  type?: PartyType;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsEnum(DebtType)
  balanceType?: DebtType;

  @IsOptional()
  @IsEnum(PartySummarySortBy)
  sortBy?: PartySummarySortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @IsOptional()
  @IsIn(['today', 'last_7_days', 'this_month'])
  createdRange?: 'today' | 'last_7_days' | 'this_month';

  @IsOptional()
  @IsDateString({}, { message: 'createdFrom must be a valid date' })
  createdFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'createdTo must be a valid date' })
  createdTo?: string;
}
