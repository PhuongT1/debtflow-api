import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class SwitchOrganizationDto { @ApiProperty() @IsString() organizationId!: string; }
