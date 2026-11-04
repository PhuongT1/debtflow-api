import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { AccountController } from './controllers/account.controller.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthController, AccountController],
  providers: [AuthService],
})
export class AuthApiModule {}
