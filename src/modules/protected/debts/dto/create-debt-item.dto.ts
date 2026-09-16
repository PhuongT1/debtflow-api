import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CreateDebtItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitPrice!: string;
}
