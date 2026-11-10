/**
 * Exposes credential login, token refresh and organization-switch HTTP endpoints.
 * Binds validated requests to AuthService; route metadata defines public/authenticated access.
 */
import { API_ROUTES } from '@common/constants/api-routes.constants.js';
import { API_TAGS } from '@common/constants/api-tags.constants.js';
import { ApiEnvelope } from '@common/swagger/decorators/api-envelope.decorator.js';
import { SessionResponseDto } from '../dto/auth-response.dto.js';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '@auth/decorators/current-user.decorator.js';
import { PublicApi, ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import type { JwtAuthPayload } from '@auth/types/auth-context.types.js';
import { AuthService } from '@modules/auth/auth.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RefreshTokenDto } from '../dto/refresh-token.dto.js';
import { SwitchOrganizationDto } from '../dto/switch-organization.dto.js';

@ApiTags(API_TAGS.AUTH)
@Controller(API_ROUTES.AUTH.PREFIX)
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
  @Post(API_ROUTES.AUTH.LOGIN)
  @ApiEnvelope(SessionResponseDto)
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @ApiOperation({
    summary: 'Switch the active organization',
    description: 'Issues a new token pair scoped to another organization the user belongs to.',
  })
  @ProtectedApi()
  @Post(API_ROUTES.AUTH.SWITCH_ORGANIZATION)
  @ApiEnvelope(SessionResponseDto, { status: HttpStatus.CREATED })
  switchOrganization(@CurrentUser() user: JwtAuthPayload, @Body() body: SwitchOrganizationDto) {
    return this.authService.switchOrganization(user.sub, body.organizationId);
  }

  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token không hợp lệ hoặc đã hết hạn.' })
  @PublicApi()
  @HttpCode(HttpStatus.OK)
  @Post(API_ROUTES.AUTH.REFRESH)
  @ApiEnvelope(SessionResponseDto)
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }
}
