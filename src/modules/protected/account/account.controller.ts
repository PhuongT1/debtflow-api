import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtectedApi } from '@auth/auth-api.decorator';
import { AuthService } from '@auth/auth.service';
import { CurrentUser } from '@auth/current-user.decorator';
import { JwtAuthPayload } from '@auth/jwt-auth.guard';

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
