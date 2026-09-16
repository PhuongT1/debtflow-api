import { IsEmail, IsEnum, IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';
import { PartyType } from '@generated/prisma';

export class CreatePartyDto {
  @IsEnum(PartyType)
  type!: PartyType;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  provinceCode?: string;

  @IsOptional()
  @IsString()
  provinceName?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
