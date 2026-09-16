import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { OrganizationRole, UserStatus } from '@generated/prisma';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(8, 20)
  phone?: string | null;

  @ApiPropertyOptional({ enum: OrganizationRole })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
