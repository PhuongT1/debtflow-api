import { IsDateString, IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { DebtType, PartyType } from '@generated/prisma';

export class QueryPartiesDto extends PaginationQueryDto {
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

  /** Shortcut for the creation date window, used when `createdFrom`/`createdTo` are absent. */
  @IsOptional()
  @IsIn(['today', 'last_7_days', 'this_month'])
  createdRange?: 'today' | 'last_7_days' | 'this_month';

  /** Created on or after this date (`YYYY-MM-DD`). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  createdFrom?: string;

  /** Created on or before this date (`YYYY-MM-DD`). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  createdTo?: string;
}
