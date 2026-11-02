import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AuthController } from './controllers/auth.controller';
import { AccountController } from './controllers/account.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [AuthModule],
  controllers: [AuthController, AccountController],
  providers: [AuthService],
})
export class AuthApiModule {}
