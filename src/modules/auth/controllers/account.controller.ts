import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '@auth/decorators/auth-api.decorator';
import { AuthService } from '@modules/auth/services/auth.service';
import { CurrentUser } from '@auth/decorators/current-user.decorator';
import type { JwtAuthPayload } from '@auth/types/auth-context.types';

@ApiTags('Auth')
@ProtectedApi()
@Controller('auth')
export class AccountController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get the current user and their organizations' })
  @Get('me')
  me(@CurrentUser() user: JwtAuthPayload) {
    return this.authService.getCurrentUser(user.sub);
  }
}
