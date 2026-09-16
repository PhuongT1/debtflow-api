import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom must be a valid date' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateTo must be a valid date' })
  dateTo?: string;
}
