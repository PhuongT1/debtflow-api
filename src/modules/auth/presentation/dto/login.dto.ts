import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'owner@anphu-fashion.demo',
    description: 'Login email.',
  })
  @IsEmail(
    {},
    {
      message: 'validation.AUTH_EMAIL_INVALID_FORMAT',
      context: { code: 'AUTH_EMAIL_INVALID_FORMAT' },
    },
  )
  @IsString({
    message: 'validation.AUTH_EMAIL_INVALID_TYPE',
    context: { code: 'AUTH_EMAIL_INVALID_TYPE' },
  })
  @IsNotEmpty({
    message: 'validation.AUTH_EMAIL_REQUIRED',
    context: { code: 'AUTH_EMAIL_REQUIRED', statusCode: HttpStatus.BAD_REQUEST },
  })
  email!: string;

  @ApiProperty({
    example: 'Demo@123456',
    minLength: 8,
    description: 'Account password.',
  })
  @MinLength(8, {
    message: 'validation.AUTH_PASSWORD_TOO_SHORT',
    context: { code: 'AUTH_PASSWORD_TOO_SHORT' },
  })
  @IsString({
    message: 'validation.AUTH_PASSWORD_INVALID_TYPE',
    context: { code: 'AUTH_PASSWORD_INVALID_TYPE' },
  })
  @IsNotEmpty({
    message: 'validation.AUTH_PASSWORD_REQUIRED',
    context: { code: 'AUTH_PASSWORD_REQUIRED', statusCode: HttpStatus.BAD_REQUEST },
  })
  password!: string;

  @ApiProperty({
    required: false,
    description:
      'Optional. Omit to select the earliest created active membership in an active organization. ' +
      'Supply a real organization ID only to choose a specific workspace you belong to; do not send the placeholder "string".',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
