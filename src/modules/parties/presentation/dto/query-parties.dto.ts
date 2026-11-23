import {
  PARTY_CREATED_RANGES,
  type PartyCreatedRange,
  type PartyListInput,
} from '../../application/party.inputs.js';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto.js';
import { BUSINESS_DATE_PATTERN } from '@common/utils/business-date.util.js';
import { DebtType, PartyType } from '@generated/prisma/client.js';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryPartiesDto extends PaginationQueryDto implements PartyListInput {
  /** Accent-insensitive search over name, code, phone and tax code. */
  @IsOptional()
  @IsString()
  q?: string;

  /** Only customers, suppliers or both. */
  @IsOptional()
  @IsEnum(PartyType)
  type?: PartyType;

  /** Only parties assigned to this member. */
  @IsOptional()
  @IsString()
  assignedToId?: string;

  /** Only parties that still have unsettled debts of this direction. */
  @IsOptional()
  @IsEnum(DebtType)
  balanceType?: DebtType;

  /** Vietnam calendar window: today, the last seven days including today, or this month. Used when both explicit dates are absent. */
  @IsOptional()
  @IsIn(PARTY_CREATED_RANGES)
  createdRange?: PartyCreatedRange;

  /** Created from the start of this date in Vietnam (`YYYY-MM-DD`, inclusive). */
  @ApiPropertyOptional({ pattern: BUSINESS_DATE_PATTERN.source })
  @IsOptional()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsDateString({ strict: true })
  createdFrom?: string;

  /** Created through the end of this date in Vietnam (`YYYY-MM-DD`, inclusive). */
  @ApiPropertyOptional({ pattern: BUSINESS_DATE_PATTERN.source })
  @IsOptional()
  @Matches(BUSINESS_DATE_PATTERN)
  @IsDateString({ strict: true })
  createdTo?: string;
}
