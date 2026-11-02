import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';

export class QueryPaymentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  debtId?: string;

  @IsOptional()
  @IsString()
  partyId?: string;
}
