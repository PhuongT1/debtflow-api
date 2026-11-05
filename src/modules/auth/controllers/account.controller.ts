import { API_ROUTES } from '@common/constants/api-routes.constants.js';
import { API_TAGS } from '@common/constants/api-tags.constants.js';
import { ApiEnvelope } from '@common/http/api-envelope.decorator.js';
import { CurrentUserResponseDto } from '../dto/auth-response.dto.js';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator.js';
import { AuthService } from '@modules/auth/auth.service.js';
import { CurrentUser } from '@auth/decorators/current-user.decorator.js';
import type { JwtAuthPayload } from '@auth/types/auth-context.types.js';

@ApiTags(API_TAGS.AUTH)
@ProtectedApi()
@Controller(API_ROUTES.AUTH.PREFIX)
export class AccountController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get the current user and their organizations' })
  @Get(API_ROUTES.AUTH.ME)
  @ApiEnvelope(CurrentUserResponseDto)
  me(@CurrentUser() user: JwtAuthPayload) {
    return this.authService.getCurrentUser(user.sub);
  }
}
