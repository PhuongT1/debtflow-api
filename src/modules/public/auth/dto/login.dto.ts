import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@debtflow.local',
    description: 'Email đăng nhập.',
  })
  @IsEmail(
    {},
    { message: 'Email phải đúng format', context: { code: 'AUTH_EMAIL_INVALID_FORMAT' } },
  )
  @IsString({ message: 'Email phải là chuỗi.', context: { code: 'AUTH_EMAIL_INVALID_TYPE' } })
  @IsNotEmpty({
    message: 'Vui lòng nhập email.',
    context: { code: 'AUTH_EMAIL_REQUIRED', statusCode: HttpStatus.BAD_REQUEST },
  })
  email!: string;

  @ApiProperty({
    example: 'Admin@123456',
    minLength: 8,
    description: 'Mật khẩu tài khoản.',
  })
  @MinLength(8, {
    message: 'Mật khẩu phải có ít nhất 8 ký tự.',
    context: { code: 'AUTH_PASSWORD_TOO_SHORT' },
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi.', context: { code: 'AUTH_PASSWORD_INVALID_TYPE' } })
  @IsNotEmpty({
    message: 'Vui lòng nhập mật khẩu.',
    context: { code: 'AUTH_PASSWORD_REQUIRED', statusCode: HttpStatus.BAD_REQUEST },
  })
  password!: string;

  @ApiProperty({ required: false, description: 'Organization ID when the user belongs to more than one workspace.' })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
