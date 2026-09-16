import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '@auth/current-user.decorator';
import { PublicApi, ProtectedApi } from '@auth/auth-api.decorator';
import type { JwtAuthPayload } from '@auth/jwt-auth.guard';
import { AuthService } from '@auth/auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu' })
  @ApiBody({ type: LoginDto })
  @ApiUnauthorizedResponse({ description: 'Sai tài khoản, mật khẩu hoặc tài khoản bị khóa.' })
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @ProtectedApi()
  @Post('switch-organization')
  switchOrganization(@CurrentUser() user: JwtAuthPayload, @Body() body: SwitchOrganizationDto) {
    return this.authService.switchOrganization(user.sub, body.organizationId);
  }

  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token không hợp lệ hoặc đã hết hạn.' })
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }
}
