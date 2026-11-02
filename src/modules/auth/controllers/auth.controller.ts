import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import { PublicApi, ProtectedApi } from '@auth/decorators/auth-api.decorator';
import type { JwtAuthPayload } from '@auth/types/auth-context.types';
import { AuthService } from '@modules/auth/services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SwitchOrganizationDto } from '../dto/switch-organization.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'organizationId is optional. When omitted, the earliest created active membership in an active ' +
      'organization is selected. The returned access token contains the selected organization context.',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      demo: {
        summary: 'Demo owner — automatically select organization',
        value: { email: 'owner@anphu-fashion.demo', password: 'Demo@123456' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Sai tài khoản, mật khẩu hoặc tài khoản bị khóa.' })
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @ApiOperation({
    summary: 'Switch the active organization',
    description: 'Issues a new token pair scoped to another organization the user belongs to.',
  })
  @ProtectedApi()
  @Post('switch-organization')
  switchOrganization(@CurrentUser() user: JwtAuthPayload, @Body() body: SwitchOrganizationDto) {
    return this.authService.switchOrganization(user.sub, body.organizationId);
  }

  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token không hợp lệ hoặc đã hết hạn.' })
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }
}
